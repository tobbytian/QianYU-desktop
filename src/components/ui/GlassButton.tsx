import { type ReactNode, type ButtonHTMLAttributes } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

const base =
  "inline-flex items-center justify-center font-medium transition-all duration-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]";

const variants = {
  primary:
    "bg-gradient-to-r from-gray-700 to-gray-900 dark:from-gray-200 dark:to-white text-white dark:!text-[#020617] shadow-lg shadow-gray-900/25 dark:shadow-gray-100/20 hover:shadow-xl hover:shadow-gray-900/30 dark:hover:shadow-white/30 hover:brightness-110 focus:ring-gray-400/50",
  danger:
    "bg-gradient-to-r from-red-500 to-rose-500 dark:from-red-400 dark:to-rose-400 text-white shadow-lg shadow-red-500/25 dark:shadow-red-400/20 hover:shadow-xl hover:shadow-red-500/30 hover:brightness-110 focus:ring-red-400/50",
  ghost:
    "backdrop-blur-lg bg-white/40 dark:bg-white/[0.06] border border-white/20 dark:border-white/[0.08] text-gray-700 dark:text-gray-200 hover:bg-white/60 dark:hover:bg-white/[0.1] focus:ring-white/30",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm space-x-1.5 gap-1.5",
  md: "px-5 py-2.5 text-sm space-x-2 gap-2",
  lg: "px-6 py-3 text-base space-x-2 gap-2",
};

export function GlassButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: GlassButtonProps) {
  return (
    <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {children}
    </button>
  );
}
