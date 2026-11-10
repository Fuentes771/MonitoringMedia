import { Rss, Video, Globe } from 'lucide-react';

interface PlatformBreakdownProps {
  platforms: Record<string, number>;
}

export function PlatformBreakdown({ platforms }: PlatformBreakdownProps) {
  const total = Object.values(platforms).reduce((acc, v) => acc + v, 0);

  const getPlatformIcon = (key: string) => {
    switch (key.toLowerCase()) {
      case 'rss':
        return <Rss className="w-3.5 h-3.5 text-amber-400" />;
      case 'youtube':
        return <Video className="w-3.5 h-3.5 text-rose-500" />;
      case 'x':
      case 'twitter':
        return (
          <svg className="w-3.5 h-3.5 text-zinc-100" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'tiktok':
        return (
          <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-3.5 h-3.5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.82 0-1.666.28-1.666 1.369v2.611h3.708l-.571 3.667h-3.137v7.98H9.101z" />
          </svg>
        );
      default:
        return <Globe className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const getPlatformName = (key: string) => {
    switch (key.toLowerCase()) {
      case 'rss':
        return 'Media Berita (RSS)';
      case 'youtube':
        return 'YouTube Publik';
      case 'x':
      case 'twitter':
        return 'Twitter / X';
      case 'tiktok':
        return 'TikTok Video';
      case 'instagram':
        return 'Instagram Feed & Reels';
      case 'facebook':
        return 'Facebook Publik';
      case 'reddit':
        return 'Komunitas Reddit';
      default:
        return key.charAt(0).toUpperCase() + key.slice(1);
    }
  };

  const getProgressColor = (prov: string) => {
    switch (prov.toLowerCase()) {
      case 'youtube':
        return 'bg-rose-500';
      case 'rss':
        return 'bg-amber-400';
      case 'x':
      case 'twitter':
        return 'bg-zinc-200';
      case 'tiktok':
        return 'bg-cyan-400';
      case 'instagram':
        return 'bg-gradient-to-r from-pink-500 to-purple-500';
      case 'facebook':
        return 'bg-blue-600';
      case 'reddit':
        return 'bg-orange-500';
      default:
        return 'bg-zinc-400';
    }
  };

  return (
    <div className="bento-card p-5 sm:p-6 bg-[#0e1117] flex flex-col justify-between transition-all">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-blue-400 block">
            Saluran Ingesti
          </span>
          <span className="text-xs text-zinc-400 font-mono-code">
            {Object.keys(platforms).length} Sumber Terhubung
          </span>
        </div>
        <h4 className="font-editorial text-lg font-medium tracking-tight text-white mb-1">
          Distribusi Sumber Data
        </h4>
        <p className="text-xs text-zinc-400 mb-4 font-sans-ui">
          Proporsi volume berdasarkan asal platform publikasi
        </p>

        <div className="space-y-3">
          {Object.entries(platforms).length === 0 ? (
            <div className="text-xs text-zinc-500 py-6 text-center font-sans-ui">
              Belum ada percakapan terkumpul dari sumber data
            </div>
          ) : (
            Object.entries(platforms).map(([provider, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={provider} className="space-y-1.5 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-zinc-200 font-medium font-sans-ui">
                      {getPlatformIcon(provider)}
                      <span className="font-semibold text-white">{getPlatformName(provider)}</span>
                    </div>
                    <div className="text-zinc-400 text-xs font-mono-code">
                      <span className="font-bold text-white">{count.toLocaleString('id-ID')}</span>
                      <span className="text-zinc-500 ml-1.5">({pct}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all duration-300 ${getProgressColor(provider)}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
