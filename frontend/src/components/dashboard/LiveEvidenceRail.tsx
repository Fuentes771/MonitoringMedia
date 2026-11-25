import { ArrowRight, Radio, ChevronRight, Newspaper, Sparkles } from 'lucide-react';
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
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Positif
          </span>
        );
      case 'negative':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-rose-500/15 text-rose-400 border border-rose-500/30">
            Negatif
          </span>
        );
      case 'neutral':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-white/[0.05] text-zinc-300 border border-white/[0.1]">
            Netral
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono-code bg-white/[0.05] text-zinc-400 border border-white/[0.1]">
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
    <div className="bento-card p-4 sm:p-5 lg:p-6 bg-[#0e1117] flex flex-col max-h-[500px] md:max-h-[540px] xl:h-[640px] xl:max-h-none">
      {/* Header */}
      <div className="pb-3.5 sm:pb-4 mb-3 border-b border-white/[0.08]">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 min-w-0">
            <Radio className="w-3 h-3 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="truncate">Kawat Media &amp; Opini Publik</span>
          </span>
          <button
            type="button"
            onClick={onViewAllMentions}
            className="min-h-9 px-2 -mr-2 rounded-lg text-[11px] font-mono-code text-zinc-300 hover:text-white hover:bg-white/[0.05] transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <span>Semua</span>
            <ArrowRight className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
        <h3 className="font-editorial text-lg sm:text-xl font-medium tracking-tight text-white">
          Arus Pemberitaan &amp; Media Sosial
        </h3>
        <p className="text-[11px] text-zinc-400 font-sans-ui mt-0.5">
          Artikel media nasional dan percakapan publik lintas platform
        </p>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain space-y-3.5 pr-1 divide-y divide-white/[0.06]">
        {isLoading ? (
          <div className="space-y-3 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-3 rounded-xl border border-white/[0.05] bg-white/[0.02] animate-pulse space-y-2">
                <div className="h-3 bg-white/[0.08] rounded w-1/3" />
                <div className="h-4 bg-white/[0.12] rounded w-full" />
                <div className="h-3 bg-white/[0.06] rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : mentions.length === 0 ? (
          <div className="text-center py-12 sm:py-20 text-zinc-400">
            <Newspaper className="w-7 h-7 mx-auto mb-2 opacity-40 text-zinc-400" aria-hidden="true" />
            <p className="text-xs font-sans-ui">Belum ada sebutan berita yang terekam</p>
          </div>
        ) : (
          mentions.map((item, idx) => {
            const firstKeyword = item.keywords && item.keywords.length > 0 ? item.keywords[0].keyword : null;
            const sourceLabel = resolveSourceLabel(item);
            const isSoc = isSocialProvider(item.provider);
            return (
              <div
                key={item.id || idx}
                role="button"
                tabIndex={0}
                onClick={() => onSelectMention(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMention(item);
                  }
                }}
                className="pt-3.5 first:pt-0 group cursor-pointer transition-all rounded-lg"
              >
                {/* Meta Top */}
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 mb-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-400 font-mono-code min-w-0">
                    <PlatformBadge
                      provider={item.provider}
                      size="xs"
                      compactLabel
                      isComment={Boolean(item.metadata_json?.is_comment)}
                    />
                    <span className="font-semibold text-zinc-200 truncate max-w-[120px]">
                      {sourceLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getSentimentBadge(item.sentiment?.label)}
                    <span className="text-zinc-400 font-mono-code text-[10px]">
                      {formatTimeAgo(item.published_at)}
                    </span>
                  </div>
                </div>

                {/* Headline */}
                <h4 className="text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-amber-300 line-clamp-2 leading-snug transition-colors font-sans-ui">
                  {item.text}
                </h4>

                {/* Sub info */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-zinc-400 pt-1">
                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {firstKeyword ? (
                      <span className="inline-flex items-center gap-1 text-zinc-300 bg-white/[0.04] px-1.5 py-0.5 rounded font-mono-code">
                        <span className="text-amber-400">#</span>
                        <span className="truncate max-w-[90px]">{firstKeyword}</span>
                      </span>
                    ) : null}
                    <LinkVerificationBadge
                      provider={item.provider}
                      sourceUrl={item.source_url}
                      linkStatus={item.link_status || item.metadata_json?.link_status}
                      isDemo={item.is_demo}
                      compact
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {onAskAi && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskAi(
                            isSoc
                              ? `Analisis opini media sosial (${getPlatformMeta(item.provider).label}): "${item.text}" dari akun ${sourceLabel}`
                              : `Analisis sebutan berita: "${item.text}" dari sumber ${sourceLabel}`
                          );
                        }}
                        title="Tanyakan AI tentang sebutan ini"
                        className="min-h-8 px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 hover:border-amber-400/45 transition-colors flex items-center gap-1 font-mono-code cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" aria-hidden="true" />
                        <span>Tanya AI</span>
                      </button>
                    )}
                    <span className="inline-flex items-center gap-0.5 text-zinc-300 group-hover:text-white transition-colors font-sans-ui">
                      <span>Inspeksi</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Action */}
      <div className="pt-3 mt-2 border-t border-white/[0.08]">
        <button
          type="button"
          onClick={onViewAllMentions}
          className="w-full min-h-11 py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/[0.1] hover:border-white/[0.2] text-xs font-semibold text-zinc-100 hover:text-white flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
        >
          <span>Eksplorasi Seluruh Sebutan</span>
          <ArrowRight className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
