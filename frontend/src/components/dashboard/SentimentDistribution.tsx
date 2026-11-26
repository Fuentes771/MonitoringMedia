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
    <section aria-label="Distribusi sentimen berita" className="surface-card p-5 sm:p-6 h-full flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-editorial text-lg font-medium tracking-tight text-[var(--text-primary)]">
              Rincian Polaritas Sentimen
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Total {total.toLocaleString('id-ID')} dokumen terklasifikasi
            </p>
          </div>
        </div>

        {/* Clean Proportional Segment Bar */}
        <div className="w-full h-2.5 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden flex gap-0.5">
          <div
            style={{ width: `${posPct}%` }}
            className="bg-[var(--sentiment-pos-bar)] h-full rounded-l-full transition-[width] duration-300"
            title={`Positif: ${posPct}%`}
          />
          <div
            style={{ width: `${neuPct}%` }}
            className="bg-[var(--sentiment-neu-bar)] h-full transition-[width] duration-300"
            title={`Netral: ${neuPct}%`}
          />
          <div
            style={{ width: `${negPct}%` }}
            className="bg-[var(--sentiment-neg-bar)] h-full transition-[width] duration-300"
            title={`Negatif: ${negPct}%`}
          />
          {unkPct > 0 && (
            <div
              style={{ width: `${unkPct}%` }}
              className="bg-[var(--border-medium)] h-full rounded-r-full transition-[width] duration-300"
              title={`Lainnya: ${unkPct}%`}
            />
          )}
        </div>

        {/* Clean Metric Columns */}
        <div className="grid grid-cols-3 gap-2.5 text-xs">
          <div className="surface-inset p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--sentiment-pos-bar)] shrink-0" aria-hidden="true" />
              <span className="text-[var(--text-secondary)] font-medium truncate">Positif</span>
            </div>
            <div className="font-bold text-base text-[var(--text-primary)] font-tabular">{posPct}%</div>
            <div className="text-[11px] text-[var(--text-muted)] font-tabular">
              {positive.toLocaleString('id-ID')} dok
            </div>
          </div>

          <div className="surface-inset p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--sentiment-neu-bar)] shrink-0" aria-hidden="true" />
              <span className="text-[var(--text-secondary)] font-medium truncate">Netral</span>
            </div>
            <div className="font-bold text-base text-[var(--text-primary)] font-tabular">{neuPct}%</div>
            <div className="text-[11px] text-[var(--text-muted)] font-tabular">
              {neutral.toLocaleString('id-ID')} dok
            </div>
          </div>

          <div className="surface-inset p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--sentiment-neg-bar)] shrink-0" aria-hidden="true" />
              <span className="text-[var(--text-secondary)] font-medium truncate">Negatif</span>
            </div>
            <div className="font-bold text-base text-[var(--sentiment-neg)] font-tabular">{negPct}%</div>
            <div className="text-[11px] text-[var(--text-muted)] font-tabular">
              {negative.toLocaleString('id-ID')} dok
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
