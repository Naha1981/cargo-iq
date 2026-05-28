import { PackageSearch } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(241, 244, 248)' }}>
      <div className="max-w-md w-full mx-4 p-8 rounded-xl border shadow-sm text-center" style={{ backgroundColor: 'rgb(255, 255, 255)', borderColor: 'rgb(200, 208, 218)' }}>
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgb(255, 243, 232)' }}>
            <PackageSearch size={32} style={{ color: 'rgb(255, 122, 26)' }} />
          </div>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'rgb(13, 27, 42)' }}>
          Page Not Found
        </h2>
        <p className="text-sm mb-6" style={{ color: 'rgb(100, 116, 139)' }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white transition-colors no-underline"
          style={{ backgroundColor: 'rgb(255, 122, 26)' }}
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
}
