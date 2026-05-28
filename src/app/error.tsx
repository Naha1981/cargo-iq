'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('[CargoIQ] Route error:', error.message, error.digest);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(241, 244, 248)' }}>
      <div className="max-w-md w-full mx-4 p-8 rounded-xl border shadow-sm" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(200, 208, 218)' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgb(254, 242, 242)' }}>
            <AlertTriangle size={24} style={{ color: 'rgb(239, 68, 68)' }} />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: 'rgb(13, 27, 42)' }}>
            Something went wrong
          </h2>
        </div>
        <p className="text-sm mb-6" style={{ color: 'rgb(100, 116, 139)' }}>
          An unexpected error occurred. Our team has been notified. You can try again or return to the dashboard.
        </p>
        {error.digest && (
          <p className="text-xs mb-4 font-mono" style={{ color: 'rgb(148, 163, 184)' }}>
            Error ID: {error.digest}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white transition-colors"
            style={{ backgroundColor: 'rgb(255, 122, 26)' }}
          >
            <RefreshCw size={16} />
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 rounded-md text-sm font-medium border transition-colors"
            style={{ borderColor: 'rgb(200, 208, 218)', color: 'rgb(61, 81, 102)' }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
