import { Smile, Meh, Frown, HelpCircle } from 'lucide-react';

interface SentimentDistributionProps {
  positive: number;
  neutral: number;
  negative: number;
  unknown: number;
}

export function SentimentDistribution({
  positive,
  neutral,
  negative,
  unknown,
}: SentimentDistributionProps) {
  const total = positive + neutral + negative + unknown;
  const posPct = total > 0 ? Math.round((positive / total) * 100) : 0;
  const neuPct = total > 0 ? Math.round((neutral / total) * 100) : 0;
  const negPct = total > 0 ? Math.round((negative / total) * 100) : 0;
  const unkPct = total > 0 ? Math.round((unknown / total) * 100) : 0;

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-white tracking-tight">
            Distribusi Sentimen Publik
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">
            {total} Total Sampel
          </span>
        </div>
        <p className="text-xs text-slate-400 mb-4">
          Proporsi kecenderungan opini berdasarkan teks percakapan
        </p>

        {/* Multi-segment Progress Bar */}
        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden flex mb-4 border border-slate-800">
          <div style={{ width: `${posPct}%` }} className="bg-emerald-500 h-full transition-all" title={`Positif: ${posPct}%`} />
          <div style={{ width: `${neuPct}%` }} className="bg-slate-500 h-full transition-all" title={`Netral: ${neuPct}%`} />
          <div style={{ width: `${negPct}%` }} className="bg-rose-500 h-full transition-all" title={`Negatif: ${negPct}%`} />
          <div style={{ width: `${unkPct}%` }} className="bg-violet-500 h-full transition-all" title={`Unknown: ${unkPct}%`} />
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smile className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Positif</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-white">{posPct}%</span>
              <span className="text-[10px] text-slate-400 block">({positive})</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Meh className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">Netral</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-white">{neuPct}%</span>
              <span className="text-[10px] text-slate-400 block">({neutral})</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Frown className="w-4 h-4 text-rose-400" />
              <span className="text-slate-300">Negatif</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-white">{negPct}%</span>
              <span className="text-[10px] text-slate-400 block">({negative})</span>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-violet-400" />
              <span className="text-slate-300">Unknown</span>
            </div>
            <div className="text-right">
              <span className="font-bold text-white">{unkPct}%</span>
              <span className="text-[10px] text-slate-400 block">({unknown})</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-800/60">
        Klasifikasi sentimen mencakup analisis slang lokal dan pembalikan negasi.
      </div>
    </div>
  );
}
