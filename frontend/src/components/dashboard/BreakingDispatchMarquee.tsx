import { useState } from 'react';
import { Sparkles, Pause, Play } from 'lucide-react';
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
  const [isPaused, setIsPaused] = useState(false);

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

  const tickerItems = [...mentions, ...mentions];

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0e14] flex items-center shadow-xs">
      {/* Compact Mobile Badge / Full Desktop Badge */}
      <div className="px-2.5 sm:px-3 py-2.5 bg-white/[0.05] border-r border-white/[0.08] flex items-center gap-1.5 sm:gap-2 shrink-0 z-10">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        <span className="sm:hidden text-[10.5px] font-mono-code font-bold uppercase tracking-wider text-white">
          Live
        </span>
        <span className="hidden sm:inline text-[11px] font-mono-code font-bold uppercase tracking-wider text-white">
          Arus Opini &amp; Berita Live
        </span>
      </div>

      {/* Marquee Strip (pausable via button for touch & WCAG R-39) */}
      <div className="overflow-hidden whitespace-nowrap flex-1 min-w-0 py-1">
        <div
          className="animate-marquee hover:[animation-play-state:paused] flex items-center gap-6 sm:gap-8 pl-3 sm:pl-4"
          style={isPaused ? { animationPlayState: 'paused' } : undefined}
        >
          {tickerItems.map((item, idx) => {
            const sourceLabel = resolveSourceLabel(item);
            const isSoc = isSocialProvider(item.provider);
            return (
              <span
                key={`${item.id}-${idx}`}
                className="inline-flex items-center gap-2 text-xs text-zinc-300 transition-colors group shrink-0"
              >
                <button
                  type="button"
                  onClick={() => onSelectMention(item)}
                  className="flex items-center gap-1.5 min-h-9 text-zinc-300 text-[11px] hover:text-white cursor-pointer"
                  title="Inspeksi bukti sebutan ini"
                >
                  <PlatformIcon provider={item.provider} className="w-3 h-3 shrink-0" />
                  <span className="font-medium text-zinc-200 font-mono-code hover:underline max-w-[110px] sm:max-w-none truncate">
                    {sourceLabel}
                  </span>
                </button>
                {getSentimentDot(item.sentiment?.label)}
                <button
                  type="button"
                  onClick={() => onSelectMention(item)}
                  className="truncate max-w-[190px] sm:max-w-[340px] min-h-9 font-sans-ui text-zinc-100 hover:text-amber-200 text-left cursor-pointer"
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
                    aria-label={`Tanyakan AI tentang sebutan dari ${sourceLabel}`}
                    className="min-w-8 min-h-8 flex items-center justify-center rounded hover:bg-amber-500/20 text-zinc-400 hover:text-amber-300 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
                <span className="text-zinc-600" aria-hidden="true">&bull;</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Explicit Pause/Play Control (R-39 & Touch Usability) */}
      <button
        type="button"
        onClick={() => setIsPaused((prev) => !prev)}
        aria-pressed={isPaused}
        aria-label={isPaused ? 'Lanjutkan arus berita berjalan' : 'Jeda arus berita berjalan'}
        title={isPaused ? 'Lanjutkan ticker' : 'Jeda ticker'}
        className="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center border-l border-white/[0.08] bg-[#0c0e14] text-zinc-300 hover:text-white hover:bg-white/[0.06] active:bg-white/[0.1] shrink-0 transition-colors z-10"
      >
        {isPaused ? (
          <Play className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
        ) : (
          <Pause className="w-3.5 h-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
