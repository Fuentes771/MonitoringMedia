import { ArrowUpRight, Flame } from 'lucide-react';

interface RisingTopic {
  id: number;
  name: string;
  description: string | null;
  mentions_count: number;
  trend_score: number;
  sample_count: number;
  explanation: string;
  components?: {
    volume?: number;
    growth?: number;
    acceleration?: number;
    source_diversity?: number;
    persistence?: number;
  } | null;
}

interface RisingTopicsCardProps {
  topics: RisingTopic[];
  onSelectTopic: (id: number) => void;
}

export function RisingTopicsCard({ topics, onSelectTopic }: RisingTopicsCardProps) {
  return (
    <div className="bento-card p-6 bg-[#0e1117] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-white/[0.08]">
        <div>
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-0.5">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            <span>Radar Lonjakan Isu</span>
          </span>
          <h3 className="font-editorial text-xl font-medium tracking-tight text-white">
            Topik dengan Akselerasi Tercepat
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-sans-ui">
            Isu yang mengalami lonjakan volume percakapan signifikan dalam 24 jam terakhir
          </p>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono-code hidden sm:block bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.06]">
          Skor Akselerasi (0-100)
        </span>
      </div>

      {/* Topics list */}
      <div className="space-y-3">
        {topics.length === 0 ? (
          <div className="text-xs text-zinc-500 py-12 text-center font-sans-ui">
            Belum ada topik yang melewati ambang batas akselerasi tren saat ini
          </div>
        ) : (
          topics.map((topic, index) => {
            const scorePct = Math.min(100, Math.max(0, topic.trend_score));
            return (
              <div
                key={topic.id}
                onClick={() => onSelectTopic(topic.id)}
                className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all cursor-pointer group shadow-xs"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 font-medium text-xs text-zinc-200 group-hover:text-white transition-colors">
                    <span className="w-5 h-5 rounded-md bg-white/[0.06] text-zinc-300 text-[11px] font-bold flex items-center justify-center font-mono-code border border-white/[0.08]">
                      {index + 1}
                    </span>
                    <span className="font-bold text-sm text-white group-hover:text-amber-300 transition-colors font-sans-ui">
                      {topic.name}
                    </span>
                  </div>
                  <div className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono-code shrink-0 bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-amber-400" />
                    <span>{topic.trend_score}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed mb-3 pl-7.5 font-sans-ui">
                  {topic.explanation}
                </p>

                {/* Micro Momentum Gauge */}
                <div className="pl-7.5 mb-2.5">
                  <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${scorePct}%` }}
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-400 pt-2 border-t border-white/[0.05] pl-7.5 font-sans-ui">
                  <span className="font-mono-code text-[11px] text-zinc-300">
                    {topic.mentions_count} sebutan terverifikasi
                  </span>
                  <span className="text-zinc-300 group-hover:text-white flex items-center gap-1 font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
                    <span>Telusuri Bukti</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
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
