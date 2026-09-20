"""Reclaim leaked Postgres connections held by backend workers that no longer exist.

Why this exists
---------------
Supabase's direct connection port allows only a few dozen connections per project.
A backend worker that is force-killed (or crashes mid-request) can leave its server
side sessions behind as `idle` or `idle in transaction`. Enough of those and every
request fails with:

    asyncpg.exceptions.TooManyConnectionsError:
        remaining connection slots are reserved for roles with the SUPERUSER attribute

The application now guards against creating these (small pool, rollback on teardown,
`idle_in_transaction_session_timeout`), but connections leaked *before* that fix, or
by an unclean shutdown, still need clearing once.

Usage
-----
    .venv/Scripts/python.exe scripts/reap_idle_connections.py            # show only
    .venv/Scripts/python.exe scripts/reap_idle_connections.py --apply    # terminate

Safety
------
Only sessions matching all of the following are ever terminated:
  * on the current database, owned by the current user
  * state is `idle` or `idle in transaction` (never `active`)
  * idle for longer than --min-idle-seconds (default 60)
  * not this script's own connection

Supabase's own managed connections (pg_cron, PostgREST, pg_net, postgres_exporter)
run as different roles or application names and are left untouched.
"""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import asyncpg  # noqa: E402

from app.config import settings  # noqa: E402

# Supabase runs its own managed services as the same role. They keep long-lived idle
# connections by design and must never be terminated here.
MANAGED_SERVICE_PREFIXES = ("pg_net", "pg_cron", "PostgREST", "postgres_exporter", "supabase", "realtime")

SELECT_LEAKED = """
    select pid,
           state,
           application_name,
           extract(epoch from (now() - state_change)) as idle_seconds
    from pg_stat_activity
    where pid <> pg_backend_pid()
      and datname = current_database()
      and usename = current_user
      and state in ('idle', 'idle in transaction')
      and now() - state_change > make_interval(secs => $1)
      and not (
        coalesce(application_name, '') ilike any (array[
          'pg_net%', 'pg_cron%', 'PostgREST%', 'postgres_exporter%', 'supabase%', 'realtime%'
        ])
      )
    order by idle_seconds desc
"""


async def main(apply: bool, min_idle_seconds: float) -> int:
    url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    if not url:
        print("DATABASE_URL is not configured.", file=sys.stderr)
        return 2

    try:
        conn = await asyncpg.connect(url, timeout=15)
    except asyncpg.exceptions.TooManyConnectionsError:
        print(
            "Could not connect: the database has no free slots at all.\n"
            "Stop the backend (and any running tests) and try again, or restart the\n"
            "Supabase project from its dashboard to drop every connection at once.",
            file=sys.stderr,
        )
        return 1

    try:
        total = await conn.fetchval("select count(*) from pg_stat_activity")
        limit = await conn.fetchval("show max_connections")
        print(f"Connections in use: {total} / {limit}")

        rows = await conn.fetch(SELECT_LEAKED, min_idle_seconds)
        if not rows:
            print(f"No sessions idle for more than {min_idle_seconds:.0f}s. Nothing to do.")
            return 0

        print(f"\nFound {len(rows)} reclaimable session(s):")
        for r in rows:
            name = r["application_name"] or "(unnamed)"
            print(f"  pid={r['pid']:<8} {r['state']:<20} idle {r['idle_seconds']:.0f}s  {name}")

        if not apply:
            print("\nDry run. Re-run with --apply to terminate these sessions.")
            return 0

        terminated = 0
        for r in rows:
            try:
                if await conn.fetchval("select pg_terminate_backend($1)", r["pid"]):
                    terminated += 1
            except Exception as exc:  # a session may end on its own between the two queries
                print(f"  could not terminate pid={r['pid']}: {exc}")

        remaining = await conn.fetchval("select count(*) from pg_stat_activity")
        print(f"\nTerminated {terminated} session(s). Connections now: {remaining} / {limit}")
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="actually terminate the sessions")
    parser.add_argument(
        "--min-idle-seconds",
        type=float,
        default=60.0,
        help="only consider sessions idle longer than this (default: 60)",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(main(args.apply, args.min_idle_seconds)))
