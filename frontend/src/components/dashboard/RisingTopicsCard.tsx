import { Flame, ArrowUpRight, Target } from 'lucide-react';

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
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">
            Topik dengan Momentum Tinggi
          </h2>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          Skor Momentum (0–100)
        </span>
      </div>

      <div className="space-y-3">
        {topics.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center">
            Belum ada topik yang melewati ambang lonjakan tren.
          </div>
        ) : (
          topics.map((topic) => {
            const isHigh = topic.trend_score >= 70;
            return (
              <div
                key={topic.id}
                onClick={() => onSelectTopic(topic.id)}
                className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 hover:bg-slate-900/80 hover:border-slate-700 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="font-semibold text-slate-200 text-xs group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{topic.name}</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-xs font-mono font-bold shrink-0 ${
                    isHigh
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                  }`}>
                    {topic.trend_score} / 100
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed mb-2.5">
                  {topic.explanation}
                </p>

                {/* Metric pill tags */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[10px] text-slate-500">
                  <div className="flex items-center gap-2 font-mono">
                    <span>Sampel: {topic.sample_count} mention</span>
                    {topic.components && (
                      <span className="text-emerald-400">
                        Pertumbuhan: {Math.round((topic.components.growth || 0) * 100)}%
                      </span>
                    )}
                  </div>
                  <span className="flex items-center gap-0.5 text-indigo-400 group-hover:underline">
                    Lihat Bukti <ArrowUpRight className="w-3 h-3" />
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
