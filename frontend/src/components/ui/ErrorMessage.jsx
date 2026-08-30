"use client";

import React from "react";
import Button from "./Button";

export default function ErrorMessage({
  title = "Something went wrong",
  message = "Unable to complete request. Please verify connection and try again.",
  onRetry,
  onDismiss,
  variant = "error", // 'error' | 'warning' | 'info'
  className = "",
}) {
  const variantStyles = {
    error: {
      bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60",
      text: "text-red-800 dark:text-red-200",
      subtext: "text-red-600 dark:text-red-300",
      icon: "error",
      iconColor: "text-red-500 dark:text-red-400",
    },
    warning: {
      bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60",
      text: "text-amber-800 dark:text-amber-200",
      subtext: "text-amber-600 dark:text-amber-300",
      icon: "warning",
      iconColor: "text-amber-500 dark:text-amber-400",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60",
      text: "text-blue-800 dark:text-blue-200",
      subtext: "text-blue-600 dark:text-blue-300",
      icon: "info",
      iconColor: "text-blue-500 dark:text-blue-400",
    },
  };
  const styles = variantStyles[variant] || variantStyles.error;

  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-200 shadow-sm ${styles.bg} ${className}`}
      role="alert"
    >
      <div className="flex items-start gap-3.5">
        <div className={`p-2 rounded-xl bg-white/60 dark:bg-black/20 ${styles.iconColor} flex-shrink-0 mt-0.5 sm:mt-0`}>
          <span className="material-symbols-outlined text-2xl">{styles.icon}</span>
        </div>
        <div>
          <h4 className={`text-sm sm:text-base font-semibold ${styles.text}`}>
            {title}
          </h4>
          {message && (
            <p className={`text-xs sm:text-sm mt-0.5 ${styles.subtext} leading-relaxed`}>
              {message}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="!py-1.5 !px-3 !text-xs bg-white dark:bg-slate-900 border-current"
          >
            <span className="material-symbols-outlined text-sm mr-1">refresh</span>
            Try Again
          </Button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 ${styles.subtext} transition-colors`}
            aria-label="Dismiss error"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>
    </div>
  );
}
