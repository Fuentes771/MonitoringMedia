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
    <div className="bento-card p-4 sm:p-5 lg:p-6 bg-[#0e1117] flex flex-col justify-between transition-all h-full">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-emerald-400 block">
            Polaritas Sentimen
          </span>
          <span className="text-xs text-zinc-400 font-mono-code font-medium font-tabular">
            {total.toLocaleString('id-ID')} sebutan
          </span>
        </div>
        <h4 className="font-editorial text-lg font-medium tracking-tight text-white mb-1">
          Distribusi Sentimen Berita
        </h4>
        <p className="text-xs text-zinc-400 mb-4 font-sans-ui">
          Klasifikasi otomatis kecenderungan narasi media
        </p>

        {/* Multi-segment Progress Bar */}
        <div className="w-full h-2.5 bg-white/[0.05] rounded-full overflow-hidden flex mb-4 border border-white/[0.08] p-0.5">
          <div
            style={{ width: `${posPct}%` }}
            className="bg-emerald-500 h-full rounded-l-full transition-all duration-300 shadow-sm shadow-emerald-500/50"
            title={`Positif: ${posPct}%`}
          />
          <div
            style={{ width: `${neuPct}%` }}
            className="bg-zinc-600 h-full transition-all duration-300"
            title={`Netral: ${neuPct}%`}
          />
          <div
            style={{ width: `${negPct}%` }}
            className="bg-rose-500 h-full transition-all duration-300 shadow-sm shadow-rose-500/50"
            title={`Negatif: ${negPct}%`}
          />
          <div
            style={{ width: `${unkPct}%` }}
            className="bg-zinc-700 h-full rounded-r-full transition-all duration-300"
            title={`Lainnya: ${unkPct}%`}
          />
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-2.5 text-xs">
          {/* Positif */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between hover:border-emerald-500/30 transition-colors min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-zinc-200 font-medium font-sans-ui text-[11px] truncate">Positif</span>
            </div>
            <div>
              <span className="font-bold text-white font-mono-code font-tabular text-sm sm:text-base block">{posPct}%</span>
              <span className="text-[10px] text-zinc-400 font-mono-code font-tabular">({positive.toLocaleString('id-ID')})</span>
            </div>
          </div>

          {/* Netral */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between hover:border-zinc-700 transition-colors min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
              <span className="text-zinc-200 font-medium font-sans-ui text-[11px] truncate">Netral</span>
            </div>
            <div>
              <span className="font-bold text-white font-mono-code font-tabular text-sm sm:text-base block">{neuPct}%</span>
              <span className="text-[10px] text-zinc-400 font-mono-code font-tabular">({neutral.toLocaleString('id-ID')})</span>
            </div>
          </div>

          {/* Negatif */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex flex-col justify-between hover:border-rose-500/30 transition-colors min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span className="text-zinc-200 font-medium font-sans-ui text-[11px] truncate">Negatif</span>
            </div>
            <div>
              <span className="font-bold text-rose-400 font-mono-code font-tabular text-sm sm:text-base block">{negPct}%</span>
              <span className="text-[10px] text-zinc-400 font-mono-code font-tabular">({negative.toLocaleString('id-ID')})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
