import { ArrowRight, Rss, Radio, ChevronRight, Newspaper, Sparkles } from 'lucide-react';
import { MentionItem } from '@/lib/api';

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

  const extractDomain = (url?: string | null) => {
    if (!url) return 'Media Berita';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return 'Media Berita';
    }
  };

  return (
    <div className="bento-card p-5 sm:p-6 bg-[#0e1117] flex flex-col h-[640px]">
      {/* Header */}
      <div className="pb-4 mb-3 border-b border-white/[0.08]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Kawat Berita Realtime</span>
          </span>
          <button
            onClick={onViewAllMentions}
            className="text-[11px] font-mono-code text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <span>Semua</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <h3 className="font-editorial text-lg sm:text-xl font-medium tracking-tight text-white">
          Arus Liputan Media Indonesia
        </h3>
        <p className="text-[11px] text-zinc-400 font-sans-ui mt-0.5">
          Artikel dan kutipan langsung yang baru diekstraksi
        </p>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 divide-y divide-white/[0.06]">
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
          <div className="text-center py-20 text-zinc-500">
            <Newspaper className="w-7 h-7 mx-auto mb-2 opacity-30 text-zinc-400" />
            <p className="text-xs font-sans-ui">Belum ada sebutan berita yang terekam</p>
          </div>
        ) : (
          mentions.map((item, idx) => {
            const firstKeyword = item.keywords && item.keywords.length > 0 ? item.keywords[0].keyword : null;
            return (
              <div
                key={item.id || idx}
                onClick={() => onSelectMention(item)}
                className="pt-3.5 first:pt-0 group cursor-pointer transition-all"
              >
                {/* Meta Top */}
                <div className="flex items-center justify-between gap-2 mb-1.5 text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-400 font-mono-code">
                    <Rss className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="font-semibold text-zinc-200 truncate max-w-[130px]">
                      {extractDomain(item.source_url)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getSentimentBadge(item.sentiment?.label)}
                    <span className="text-zinc-500 font-mono-code text-[10px]">
                      {formatTimeAgo(item.published_at)}
                    </span>
                  </div>
                </div>

                {/* Headline */}
                <h4 className="text-xs sm:text-[13px] font-semibold text-zinc-100 group-hover:text-blue-400 line-clamp-2 leading-snug transition-colors font-sans-ui">
                  {item.text}
                </h4>

                {/* Sub info */}
                <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-400 pt-1">
                  <span className="text-zinc-400 font-mono-code">
                    {firstKeyword ? (
                      <span className="inline-flex items-center gap-1 text-zinc-300 bg-white/[0.04] px-1.5 py-0.5 rounded">
                        <span className="text-blue-400">#</span>
                        <span>{firstKeyword}</span>
                      </span>
                    ) : (
                      <span>Bahasa Indonesia</span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    {onAskAi && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAskAi(`Analisis sebutan berita: "${item.text}" dari sumber ${extractDomain(item.source_url)}`);
                        }}
                        title="Tanyakan AI tentang sebutan ini"
                        className="px-1.5 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors flex items-center gap-1 font-mono-code cursor-pointer"
                      >
                        <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                        <span>Tanya AI</span>
                      </button>
                    )}
                    <span className="inline-flex items-center gap-0.5 text-zinc-400 group-hover:text-white transition-colors font-sans-ui">
                      <span>Inspeksi</span>
                      <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
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
          onClick={onViewAllMentions}
          className="w-full py-2.5 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.2] text-xs font-semibold text-zinc-200 hover:text-white flex items-center justify-center gap-2 transition-all shadow-xs"
        >
          <span>Eksplorasi Seluruh Sebutan</span>
          <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
        </button>
      </div>
    </div>
  );
}
