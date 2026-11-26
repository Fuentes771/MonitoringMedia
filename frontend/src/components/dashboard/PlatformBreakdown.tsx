import { PlatformIcon } from '@/components/common/PlatformBadge';

interface PlatformBreakdownProps {
  platforms: Record<string, number>;
}

const PLATFORM_NAMES: Record<string, string> = {
  rss: 'Media Berita (RSS)',
  youtube: 'YouTube Publik',
  x: 'X (Twitter)',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok Video',
  instagram: 'Instagram',
  facebook: 'Facebook Publik',
  threads: 'Threads Publik',
  reddit: 'Komunitas Reddit',
};

export function PlatformBreakdown({ platforms }: PlatformBreakdownProps) {
  const entries = Object.entries(platforms).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, v]) => acc + v, 0);

  return (
    <section aria-label="Distribusi sumber data" className="surface-card p-5 sm:p-6 h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-editorial text-lg font-medium tracking-tight text-[var(--text-primary)]">
              Distribusi Sumber Data
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {entries.length} saluran publikasi terhubung
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="surface-inset py-8 px-4 text-center text-xs text-[var(--text-muted)]">
              Belum ada percakapan terkumpul dari konektor aktif.
            </div>
          ) : (
            entries.map(([provider, count], index) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const label =
                PLATFORM_NAMES[provider.toLowerCase()] ||
                provider.charAt(0).toUpperCase() + provider.slice(1);
              const isPrimary = index === 0;

              return (
                <div key={provider} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <PlatformIcon provider={provider} className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold text-[var(--text-primary)] truncate">{label}</span>
                    </div>
                    <div className="font-tabular text-xs shrink-0">
                      <span className="font-bold text-[var(--text-primary)]">
                        {count.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[var(--text-muted)] ml-1.5">{pct}%</span>
                    </div>
                  </div>
                  <div className="w-full h-1.5 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-[width] duration-300 ${
                        isPrimary ? 'bg-[var(--accent-gold)]' : 'bg-[var(--text-muted)]'
                      }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
