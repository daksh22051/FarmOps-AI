"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDashboard, type DashboardSnapshot } from "../../lib/api/dashboard";

// Global cache for instant farm switching and zero-delay re-renders
const snapshotCache = new Map<string, DashboardSnapshot>();

export function useDashboard(farmId: string | null) {
  const [data, setData] = useState<DashboardSnapshot | null>(() => (farmId ? snapshotCache.get(farmId) || null : null));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(() => (farmId ? !snapshotCache.has(farmId) : false));
  const controller = useRef<AbortController | null>(null);
  const activeFarmIdRef = useRef<string | null>(farmId);
  activeFarmIdRef.current = farmId;

  const refresh = useCallback(
    async (isBackground = false, retryCount = 0) => {
      controller.current?.abort();
      if (!farmId) return;

      const request = new AbortController();
      controller.current = request;
      const timeout = window.setTimeout(() => request.abort("timeout"), 25000);

      if (!isBackground) {
        setError(null);
        if (!snapshotCache.has(farmId)) {
          setLoading(true);
        }
      }

      try {
        const snapshot = await getDashboard(farmId, request.signal);
        if (!request.signal.aborted && activeFarmIdRef.current === farmId) {
          // Double verify farm_id matches to prevent stale race conditions
          if (snapshot.farm_id === farmId) {
            snapshotCache.set(farmId, snapshot);
            setData(snapshot);
            setError(null);
          }
        }
      } catch (err) {
        if (request.signal.aborted && request.signal.reason !== "timeout") {
          return;
        }

        // Automatic retry once on timeout or transient failure if active farm hasn't changed
        if (retryCount < 1 && activeFarmIdRef.current === farmId) {
          clearTimeout(timeout);
          await new Promise((resolve) => setTimeout(resolve, 1000));
          if (activeFarmIdRef.current === farmId) {
            return refresh(isBackground, retryCount + 1);
          }
        }

        if (!request.signal.aborted || request.signal.reason === "timeout") {
          setError(
            request.signal.reason === "timeout"
              ? "The telemetry server took too long to respond. Click Retry to reconnect."
              : err instanceof Error
              ? err.message
              : "Unable to load dashboard."
          );
        }
      } finally {
        clearTimeout(timeout);
        if (controller.current === request) {
          setLoading(false);
        }
      }
    },
    [farmId]
  );

  // When farmId changes: check cache for instant render, then fetch fresh data
  useEffect(() => {
    if (!farmId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const cached = snapshotCache.get(farmId);
    if (cached) {
      setData(cached);
      setError(null);
      setLoading(false);
      // Fast background refresh to keep telemetry fresh
      void refresh(true);
    } else {
      setData(null);
      setError(null);
      setLoading(true);
      void refresh(false);
    }

    const timer = window.setInterval(() => {
      if (!document.hidden && activeFarmIdRef.current === farmId) {
        void refresh(true);
      }
    }, 30000);

    const focus = () => {
      if (activeFarmIdRef.current === farmId) {
        void refresh(true);
      }
    };
    window.addEventListener("focus", focus);

    return () => {
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", focus);
    };
  }, [farmId, refresh]);

  // Strictly enforce that data must match current farmId
  const activeData = data?.farm_id === farmId ? data : null;
  const isSwitching = loading && !activeData;

  return {
    data: activeData,
    error,
    loading,
    isSwitching,
    refresh: () => refresh(false),
  };
}
