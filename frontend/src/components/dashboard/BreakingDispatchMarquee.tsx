import { Sparkles } from 'lucide-react';
import { MentionItem } from '@/lib/api';
import { PlatformIcon, getPlatformMeta, isSocialProvider } from '@/components/common/PlatformBadge';

interface BreakingDispatchMarqueeProps {
  mentions: MentionItem[];
  onSelectMention: (mention: MentionItem) => void;
  onAskAi?: (query: string) => void;
}

export function BreakingDispatchMarquee({
  mentions,
  onSelectMention,
  onAskAi,
}: BreakingDispatchMarqueeProps) {
  if (!mentions || mentions.length === 0) return null;

  const resolveSourceLabel = (item: MentionItem) => {
    if (item.author_name && item.author_name.trim()) return item.author_name;
    if (isSocialProvider(item.provider)) return getPlatformMeta(item.provider).shortLabel;
    if (!item.source_url) return 'Media Berita';
    try {
      const parsed = new URL(item.source_url);
      return parsed.hostname.replace('www.', '');
    } catch {
      return 'Media Berita';
    }
  };

  const getSentimentDot = (label?: string) => {
    switch (label) {
      case 'positive':
        return <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />;
      case 'negative':
        return <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />;
      default:
        return <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />;
    }
  };

  // Duplicate items for continuous marquee loop
  const tickerItems = [...mentions, ...mentions];

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e14] flex items-center shadow-xs">
      {/* Fixed Left Badge */}
      <div className="px-3 py-2 bg-white/[0.05] border-r border-white/[0.08] flex items-center gap-2 shrink-0 z-10 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[11px] font-mono-code font-bold uppercase tracking-wider text-white">
          Arus Opini &amp; Berita Live
        </span>
      </div>

      {/* Marquee Strip (with hover pause for accessibility & control) */}
      <div className="overflow-hidden whitespace-nowrap flex-1 py-1.5">
        <div className="animate-marquee hover:[animation-play-state:paused] flex items-center gap-8 pl-4">
          {tickerItems.map((item, idx) => {
            const sourceLabel = resolveSourceLabel(item);
            const isSoc = isSocialProvider(item.provider);
            return (
              <span
                key={`${item.id}-${idx}`}
                className="inline-flex items-center gap-2.5 text-xs text-zinc-300 transition-colors group shrink-0"
              >
                <button
                  type="button"
                  onClick={() => onSelectMention(item)}
                  className="flex items-center gap-1.5 text-zinc-400 text-[11px] hover:text-white cursor-pointer"
                  title="Inspeksi bukti sebutan ini"
                >
                  <PlatformIcon provider={item.provider} className="w-3 h-3 shrink-0" />
                  <span className="font-medium text-zinc-300 font-mono-code hover:underline">
                    {sourceLabel}
                  </span>
                </button>
                {getSentimentDot(item.sentiment?.label)}
                <button
                  type="button"
                  onClick={() => onSelectMention(item)}
                  className="truncate max-w-[340px] font-sans-ui text-zinc-200 hover:text-amber-200 text-left cursor-pointer"
                  title="Klik untuk inspeksi rincian sebutan"
                >
                  {item.text}
                </button>
                {onAskAi && (
                  <button
                    type="button"
                    onClick={() =>
                      onAskAi(
                        isSoc
                          ? `Analisis opini media sosial (${getPlatformMeta(item.provider).label}): "${item.text}" dari ${sourceLabel}`
                          : `Analisis kawat berita terkini: "${item.text}" dari ${sourceLabel}`
                      )
                    }
                    title="Tanyakan AI tentang sebutan ini"
                    className="p-1 rounded hover:bg-amber-500/20 text-zinc-500 hover:text-amber-300 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3 h-3" />
                  </button>
                )}
                <span className="text-zinc-600">&bull;</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
