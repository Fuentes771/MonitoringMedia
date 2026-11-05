import { Rss, Video, Globe } from 'lucide-react';

interface PlatformBreakdownProps {
  platforms: Record<string, number>;
}

export function PlatformBreakdown({ platforms }: PlatformBreakdownProps) {
  const total = Object.values(platforms).reduce((acc, v) => acc + v, 0);

  const getPlatformIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case 'rss':
        return <Rss className="w-4 h-4 text-amber-400" />;
      case 'youtube':
        return <Video className="w-4 h-4 text-rose-500" />;
      default:
        return <Globe className="w-4 h-4 text-indigo-400" />;
    }
  };

  const getPlatformName = (key: string) => {
    switch (key.toLowerCase()) {
      case 'rss':
        return 'Media Berita (RSS/Atom)';
      case 'youtube':
        return 'YouTube Publik';
      case 'reddit':
        return 'Reddit Komunitas';
      default:
        return key.toUpperCase();
    }
  };

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
      <div>
        <h2 className="text-sm font-bold text-white tracking-tight mb-1">
          Sebaran Sumber Platform
        </h2>
        <p className="text-xs text-slate-400 mb-4">
          Aktivitas percakapan per konektor digital
        </p>

        <div className="space-y-3">
          {Object.entries(platforms).length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">
              Belum ada data percakapan terkumpul.
            </div>
          ) : (
            Object.entries(platforms).map(([provider, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={provider} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-300 font-medium">
                      {getPlatformIcon(provider)}
                      <span>{getPlatformName(provider)}</span>
                    </div>
                    <div className="text-slate-400 font-mono">
                      <span className="font-semibold text-white">{count}</span> ({pct}%)
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-indigo-500 rounded-full transition-all"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-800/60">
        Data diambil secara legal via feed dan API resmi terotorisasi.
      </div>
    </div>
  );
}
