'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Next.js Root Global Error Boundary.
 * Catches unhandled errors in the root layout or root templates.
 * Must define its own <html> and <body> tags.
 */
export default function GlobalRootError({ error, reset }) {
  const [errorId] = useState(
    () => error?.digest || `ERR-ROOT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  );

  useEffect(() => {
    // Log exception with stable error identifier for telemetry correlation
    console.error(`[PillSync Root Global Error Boundary Caught] [Error ID: ${errorId}]:`, error);
  }, [error, errorId]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 antialiased">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
            <AlertTriangle className="w-8 h-8 animate-pulse" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Application Error
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              A critical error occurred while loading the application shell. Our clinical telemetry team has been notified.
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={() => reset()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition duration-200 shadow-lg shadow-emerald-950 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Error ID: {errorId} &bull; PillSync Clinical AI Safety
          </p>
        </div>
      </body>
    </html>
  );
}
