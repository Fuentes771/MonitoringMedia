import { ArrowUpRight, Flame } from 'lucide-react';

interface SampleMentionEvidence {
  id: number;
  provider: string;
  author_name: string;
  text: string;
  sentiment: string;
}

interface RisingTopic {
  id: number;
  name: string;
  description: string | null;
  mentions_count: number;
  trend_score: number;
  sample_count: number;
  explanation: string;
  driving_keywords?: string[];
  active_providers?: string[];
  sample_mention?: SampleMentionEvidence | null;
  components?: {
    volume?: number;
    growth?: number;
    acceleration?: number;
    source_diversity?: number;
    persistence?: number;
    driving_keywords?: string[];
    active_providers?: string[];
    sample_mention?: SampleMentionEvidence | null;
  } | null;
}

interface RisingTopicsCardProps {
  topics: RisingTopic[];
  onSelectTopic: (id: number) => void;
}

export function RisingTopicsCard({ topics, onSelectTopic }: RisingTopicsCardProps) {
  return (
    <div className="bento-card p-4 sm:p-6 bg-[#0e1117] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 sm:mb-5 pb-3.5 border-b border-white/[0.08]">
        <div className="min-w-0">
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-0.5">
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Radar Lonjakan Isu</span>
          </span>
          <h3 className="font-editorial text-lg sm:text-xl font-medium tracking-tight text-white">
            Topik dengan Akselerasi Tercepat
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-sans-ui">
            Isu yang mengalami lonjakan volume percakapan signifikan dalam 24 jam terakhir
          </p>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono-code hidden sm:block bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.06] shrink-0">
          Skor Akselerasi (0-100)
        </span>
      </div>

      {/* Topics list */}
      <div className="space-y-3">
        {topics.length === 0 ? (
          <div className="text-xs text-zinc-400 py-10 sm:py-12 text-center font-sans-ui">
            Belum ada topik yang melewati ambang batas akselerasi tren saat ini
          </div>
        ) : (
          topics.map((topic, index) => {
            const scorePct = Math.min(100, Math.max(0, topic.trend_score));
            const keywords = topic.driving_keywords ?? topic.components?.driving_keywords ?? [];
            const providers = topic.active_providers ?? topic.components?.active_providers ?? [];
            const sampleMention = topic.sample_mention ?? topic.components?.sample_mention ?? null;

            return (
              <div
                key={topic.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectTopic(topic.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTopic(topic.id);
                  }
                }}
                className="p-3.5 sm:p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.07] hover:border-white/[0.15] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-start justify-between gap-2.5 sm:gap-3 mb-2">
                  <div className="flex items-start sm:items-center gap-2.5 font-medium text-xs text-zinc-200 group-hover:text-white transition-colors min-w-0">
                    <span className="w-5 h-5 rounded-md bg-white/[0.06] text-zinc-300 text-[11px] font-bold flex items-center justify-center font-mono-code border border-white/[0.08] shrink-0 mt-0.5 sm:mt-0">
                      {index + 1}
                    </span>
                    <span className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors font-sans-ui leading-snug">
                      {topic.name}
                    </span>
                  </div>
                  <div className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono-code font-tabular shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" aria-hidden="true" />
                    <span>{topic.trend_score}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed mb-3 pl-0 sm:pl-7.5 font-sans-ui">
                  {topic.explanation.replace(/—/g, ':')}
                </p>

                {/* Driving keywords & active source platforms (PRD TREND-07) */}
                {(keywords.length > 0 || providers.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-0 sm:pl-7.5 mb-3">
                    {keywords.slice(0, 4).map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded-md text-[11px] font-mono-code bg-amber-500/10 text-amber-300 border border-amber-500/20"
                      >
                        #{kw}
                      </span>
                    ))}
                    {providers.slice(0, 4).map((prov) => (
                      <span
                        key={prov}
                        className="px-2 py-0.5 rounded-md text-[10px] font-mono-code uppercase tracking-wide bg-white/[0.04] text-zinc-300 border border-white/[0.08]"
                      >
                        {prov}
                      </span>
                    ))}
                  </div>
                )}

                {/* Sample evidence quote */}
                {sampleMention && (
                  <p className="text-[11px] text-zinc-400 italic leading-relaxed mb-3 border-l-2 border-amber-500/30 ml-0 sm:ml-7.5 pl-2.5 font-sans-ui line-clamp-2">
                    &ldquo;{sampleMention.text}&rdquo; - {sampleMention.author_name}
                  </p>
                )}

                {/* Micro Momentum Gauge */}
                <div className="pl-0 sm:pl-7.5 mb-2.5">
                  <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${scorePct}%` }}
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-400 pt-2 border-t border-white/[0.05] pl-0 sm:pl-7.5 font-sans-ui">
                  <span className="font-mono-code font-tabular text-[11px] text-zinc-300">
                    {topic.mentions_count} sebutan terverifikasi
                  </span>
                  <span className="text-zinc-200 group-hover:text-white flex items-center gap-1 font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
                    <span>Telusuri Bukti</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
