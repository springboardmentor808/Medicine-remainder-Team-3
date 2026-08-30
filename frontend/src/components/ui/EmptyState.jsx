"use client";

import React from "react";
import Link from "next/link";
import Button from "./Button";

export default function EmptyState({
  icon = "inbox",
  title = "No data found",
  description = "Get started by adding your first record.",
  actionLabel,
  onAction,
  actionHref,
  secondaryLabel,
  onSecondary,
  className = "",
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm transition-all duration-300 ${className}`}
    >
      <div className="relative mb-5">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-teal-500/10 via-cyan-500/10 to-indigo-500/10 dark:from-teal-400/20 dark:to-indigo-400/20 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-inner">
          <span className="material-symbols-outlined text-3xl sm:text-4xl select-none animate-pulse">
            {icon}
          </span>
        </div>
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-teal-400 rounded-full blur-sm opacity-60"></div>
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">
        {title}
      </h3>
      <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && (
            actionHref ? (
              <Link href={actionHref}>
                <Button variant="primary" size="md">
                  <span className="material-symbols-outlined text-lg mr-1.5">add</span>
                  {actionLabel}
                </Button>
              </Link>
            ) : (
              <Button variant="primary" size="md" onClick={onAction}>
                <span className="material-symbols-outlined text-lg mr-1.5">add</span>
                {actionLabel}
              </Button>
            )
          )}

          {secondaryLabel && (
            <Button variant="outline" size="md" onClick={onSecondary}>
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
