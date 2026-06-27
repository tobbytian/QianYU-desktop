import { type ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "elevated" | "subtle";
}

const variants = {
  default:
    "backdrop-blur-xl bg-white/60 dark:bg-white/[0.06] border border-white/20 dark:border-white/[0.08] shadow-lg shadow-black/[0.03] dark:shadow-black/20",
  elevated:
    "backdrop-blur-2xl bg-white/70 dark:bg-white/[0.08] border border-white/30 dark:border-white/[0.1] shadow-xl shadow-black/[0.06] dark:shadow-black/30",
  subtle:
    "backdrop-blur-lg bg-white/40 dark:bg-white/[0.03] border border-white/10 dark:border-white/[0.05] shadow-md shadow-black/[0.02] dark:shadow-black/10",
};

export function GlassCard({ children, className = "", variant = "default" }: GlassCardProps) {
  return (
    <div className={`rounded-2xl ${variants[variant]} ${className}`}>
      {children}
    </div>
  );
}
