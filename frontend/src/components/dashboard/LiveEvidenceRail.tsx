import { ArrowRight, ChevronRight, Newspaper, MessageSquareText } from 'lucide-react';
import { MentionItem } from '@/lib/api';
import { PlatformBadge, getPlatformMeta, isSocialProvider } from '@/components/common/PlatformBadge';
import { LinkVerificationBadge } from '@/components/common/LinkVerificationBadge';

interface LiveEvidenceRailProps {
  mentions: MentionItem[];
  isLoading: boolean;
  onSelectMention: (mention: MentionItem) => void;
  onViewAllMentions: () => void;
  onAskAi?: (query: string) => void;
}

function formatTimeAgo(dateStr: string) {
  try {
    const time = new Date(dateStr).getTime();
    const diffMs = Date.now() - time;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins}m lalu`;
    if (diffHours < 24) return `${diffHours}j lalu`;
    if (diffDays === 1) return 'Kemarin';
    return `${diffDays}h lalu`;
  } catch {
    return '';
  }
}

export function LiveEvidenceRail({
  mentions,
  isLoading,
  onSelectMention,
  onViewAllMentions,
  onAskAi,
}: LiveEvidenceRailProps) {
  const getSentimentBadge = (label?: string) => {
    switch (label) {
      case 'positive':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border border-[var(--sentiment-pos-border)]">
            Positif
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)]">
            Negatif
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--sentiment-neu-subtle)] text-[var(--sentiment-neu)] border border-[var(--sentiment-neu-border)]">
            Netral
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
            Lainnya
          </span>
        );
    }
  };

  const resolveSourceLabel = (item: MentionItem) => {
    if (item.author_name && item.author_name.trim()) {
      return item.author_name;
    }
    if (isSocialProvider(item.provider)) {
      return getPlatformMeta(item.provider).shortLabel;
    }
    if (!item.source_url) return 'Media Berita';
    try {
      const parsed = new URL(item.source_url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return 'Media Berita';
    }
  };

  return (
    <section
      aria-label="Arus pemberitaan dan opini terbaru"
      className="surface-card p-5 sm:p-6 flex flex-col max-h-[540px] xl:h-[660px] xl:max-h-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 pb-4 mb-4 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <h2 className="font-editorial text-xl font-medium tracking-tight text-[var(--text-primary)]">
            Arus Berita &amp; Opini Publik
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Bukti sebutan terbaru lintas media dan kanal sosial
          </p>
        </div>
        <button
          type="button"
          onClick={onViewAllMentions}
          className="min-h-9 px-2.5 rounded-xl text-xs font-semibold text-[var(--accent-gold-text)] hover:bg-[var(--bg-surface-elevated)] inline-flex items-center gap-1 shrink-0 transition-colors"
        >
          <span>Semua</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      {/* Scrollable Evidence Feed */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain space-y-3 pr-1">
        {isLoading ? (
          <div className="space-y-3" role="status" aria-label="Memuat arus bukti">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="surface-inset p-3.5 animate-pulse space-y-2">
                <div className="h-3 bg-[var(--border-subtle)] rounded w-1/3" />
                <div className="h-4 bg-[var(--border-medium)] rounded w-full" />
                <div className="h-3 bg-[var(--border-subtle)] rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : mentions.length === 0 ? (
          <div className="surface-inset text-center py-12 px-5 space-y-2">
            <Newspaper className="w-6 h-6 mx-auto text-[var(--text-muted)]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Belum ada sebutan yang cocok
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Ubah filter lensa analitik ke Semua Isu atau buka halaman Eksplorasi Sebutan.
            </p>
          </div>
        ) : (
          mentions.map((item, idx) => {
            const firstKeyword =
              item.keywords && item.keywords.length > 0 ? item.keywords[0].keyword : null;
            const sourceLabel = resolveSourceLabel(item);
            const isSoc = isSocialProvider(item.provider);

            return (
              <article key={item.id || idx} className="pill-row p-3.5 space-y-2">
                {/* Meta Top */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <PlatformBadge
                      provider={item.provider}
                      size="xs"
                      compactLabel
                      isComment={Boolean(item.metadata_json?.is_comment)}
                    />
                    <span className="font-semibold text-[var(--text-primary)] truncate max-w-[115px]">
                      {sourceLabel}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getSentimentBadge(item.sentiment?.label)}
                    <span className="text-[var(--text-muted)] font-mono-code font-tabular text-[10px]">
                      {formatTimeAgo(item.published_at)}
                    </span>
                  </div>
                </div>

                {/* Headline / Quote Trigger */}
                <button
                  type="button"
                  onClick={() => onSelectMention(item)}
                  className="text-left text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent-gold-text)] line-clamp-2 leading-snug transition-colors w-full"
                >
                  {item.text}
                </button>

                {/* Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {firstKeyword && (
                      <span className="inline-flex items-center gap-0.5 text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2 py-0.5 rounded-md border border-[var(--border-subtle)] text-[10.5px]">
                        <span className="text-[var(--accent-gold-text)]">#</span>
                        <span className="truncate max-w-[85px]">{firstKeyword}</span>
                      </span>
                    )}
                    <LinkVerificationBadge
                      provider={item.provider}
                      sourceUrl={item.source_url}
                      linkStatus={item.link_status || item.metadata_json?.link_status}
                      isDemo={item.is_demo}
                      compact
                    />
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onAskAi && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskAi(
                            isSoc
                              ? `Analisis opini media sosial (${getPlatformMeta(item.provider).label}): "${item.text}" dari akun ${sourceLabel}`
                              : `Analisis sebutan berita: "${item.text}" dari sumber ${sourceLabel}`
                          )
                        }
                        className="min-h-8 px-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--accent-gold-subtle)] text-[var(--text-secondary)] hover:text-[var(--accent-gold-text)] border border-[var(--border-subtle)] inline-flex items-center gap-1 transition-colors"
                      >
                        <MessageSquareText className="w-3 h-3" aria-hidden="true" />
                        <span>AI</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectMention(item)}
                      className="min-h-8 px-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium inline-flex items-center gap-0.5 transition-colors"
                    >
                      <span>Inspeksi</span>
                      <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Footer CTA */}
      <div className="pt-4 mt-3 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={onViewAllMentions}
          className="btn-ghost-surface w-full min-h-11 px-4 text-xs font-semibold inline-flex items-center justify-center gap-2"
        >
          <span>Buka Eksplorasi Sebutan</span>
          <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-gold-text)]" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
