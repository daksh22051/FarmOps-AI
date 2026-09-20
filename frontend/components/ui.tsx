import type { ReactNode } from "react";

export function PageHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="max-w-2xl">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-600">FarmOps AI</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{title}</h1>
      <p className="mt-3 text-base leading-7 text-slate-600">{description}</p>
    </div>
  );
}

export function Card({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <section
      onClick={onClick}
      className={`glass-card glass-card-hover rounded-2xl p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-xs">
      {children}
    </span>
  );
}
