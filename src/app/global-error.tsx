'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CargoIQ] Global error:', error.message, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgb(241, 244, 248)' }}>
          <div style={{ maxWidth: '28rem', width: '100%', margin: '0 1rem', padding: '2rem', borderRadius: '0.75rem', border: '1px solid rgb(200, 208, 218)', backgroundColor: 'rgb(255, 255, 255)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.5rem', borderRadius: '0.5rem', backgroundColor: 'rgb(254, 242, 242)' }}>
                <AlertTriangle size={24} color="rgb(239, 68, 68)" />
              </div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'rgb(13, 27, 42)', margin: 0 }}>
                Application Error
              </h2>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'rgb(100, 116, 139)', marginBottom: '1.5rem' }}>
              A critical error occurred. Please try refreshing the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'rgb(148, 163, 184)', marginBottom: '1rem' }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: 600, color: 'white', backgroundColor: 'rgb(255, 122, 26)', border: 'none', cursor: 'pointer' }}
            >
              <RefreshCw size={16} />
              Refresh Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
