import { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, forwardRef } from "react";

const inputBase =
  "w-full px-4 py-3 rounded-xl backdrop-blur-lg bg-white/50 dark:bg-white/[0.06] border border-white/30 dark:border-white/[0.1] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/40 dark:focus:ring-gray-400/30 focus:border-gray-300/50 dark:focus:border-gray-400/30 focus:bg-white/70 dark:focus:bg-white/[0.08]";

export const GlassInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input ref={ref} className={`${inputBase} ${className}`} {...props} />
  ),
);
GlassInput.displayName = "GlassInput";

export const GlassTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => (
    <textarea
      ref={ref}
      className={`${inputBase} resize-none ${className}`}
      {...props}
    />
  ),
);
GlassTextarea.displayName = "GlassTextarea";

export const GlassSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", ...props }, ref) => (
    <select
      ref={ref}
      className={`${inputBase} appearance-none cursor-pointer [&_option]:bg-white [&_option]:text-gray-900 ${className}`}
      {...props}
    />
  ),
);
GlassSelect.displayName = "GlassSelect";
