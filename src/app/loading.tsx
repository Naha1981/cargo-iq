import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'rgb(241, 244, 248)' }}>
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgb(255, 122, 26)' }} />
        <p className="text-sm font-medium" style={{ color: 'rgb(100, 116, 139)' }}>
          Loading CargoIQ...
        </p>
      </div>
    </div>
  );
}
