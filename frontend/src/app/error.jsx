'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

/**
 * Next.js Global Client-Side Error Boundary.
 * Catches unhandled runtime rendering crashes, network anomalies,
 * and provides structured user guidance with recovery actions.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // Log exception to monitoring telemetry if configured
    console.error('[PillSync Error Boundary Caught]:', error);
  }, [error]);

  const isPayloadTooLarge = error?.message?.includes('10 MB') || error?.message?.includes('413');
  const isNotFound = error?.message?.includes('not found') || error?.message?.includes('404');

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto text-red-400">
          <AlertTriangle className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isPayloadTooLarge
              ? 'File Exceeds Size Limit'
              : isNotFound
              ? 'Record Not Found'
              : 'Something Went Wrong'}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            {isPayloadTooLarge
              ? 'Your uploaded prescription image exceeds the 10 MB limit. Please resize or crop the image and try again.'
              : isNotFound
              ? 'The requested prescription scan or medication schedule could not be located.'
              : error?.message || 'An unexpected error occurred while processing your request.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition duration-200 shadow-lg shadow-emerald-950"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition duration-200 border border-slate-700"
          >
            <Home className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        <p className="text-xs text-slate-500">
          Error ID: {Date.now().toString(36).toUpperCase()} &bull; PillSync Clinical AI Safety
        </p>
      </div>
    </div>
  );
}
