import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ExternalLink,
  MessageSquareText,
  ArrowUpRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { DailyBriefingInfo } from '@/lib/api';
import { useTheme } from '@/hooks/useTheme';

interface ExecutiveBriefingCardProps {
  totalMentions: number;
  changePercent: number;
  negativeSharePercent: number;
  risingTopicsCount: number;
  positiveCount: number;
  neutralCount: number;
  negativeCount: number;
  dailyBriefing?: DailyBriefingInfo;
  onSelectEventMention?: (eventId: number) => void;
  onAskAi?: (query: string, topicId?: number) => void;
}

export function ExecutiveBriefingCard({
  totalMentions,
  changePercent,
  negativeSharePercent,
  risingTopicsCount,
  positiveCount,
  neutralCount,
  negativeCount,
  dailyBriefing,
  onSelectEventMention,
  onAskAi,
}: ExecutiveBriefingCardProps) {
  const { chartTokens } = useTheme();
  const isPositiveGrowth = changePercent >= 0;
  const isCriticalNegative = negativeSharePercent > 25;
  const totalSentiment = positiveCount + neutralCount + negativeCount;

  const posPct = totalSentiment > 0 ? Math.round((positiveCount / totalSentiment) * 100) : 0;
  const neuPct = totalSentiment > 0 ? Math.round((neutralCount / totalSentiment) * 100) : 0;
  const negPct = totalSentiment > 0 ? Math.round((negativeCount / totalSentiment) * 100) : 0;

  const velocityData = dailyBriefing?.hourly_velocity || [];
  const events = dailyBriefing?.chronological_events || [];
  const topProgram = dailyBriefing?.top_programs?.[0];

  const peakVelocity = velocityData.reduce<{ time_label: string; count: number } | null>(
    (max, item) => (!max || item.count > max.count ? item : max),
    null
  );

  const handlePrimaryHeroAction = () => {
    if (!onAskAi) return;
    if (topProgram) {
      onAskAi(
        `Analisis mendalam persepsi publik, isu kunci, dan dinamika sentimen pada program prioritas ${topProgram.name}`,
        topProgram.id
      );
      return;
    }
    onAskAi('Berikan sintesis eksekutif terbaru atas dinamika wacana publik dan isu yang perlu diprioritaskan hari ini.');
  };

  return (
    <section aria-label="Ringkasan eksekutif intelijen" className="space-y-5">
      {/* Split Hero Grid: Left Executive Focus (7 cols) + Right Activity & Polarity Studio (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Focal Card (Ref 1 Inspired Hero + Integrated Clean 4-KPI Dock) */}
        <div className="lg:col-span-7 surface-hero p-5 sm:p-7 lg:p-8 relative overflow-hidden flex flex-col justify-between gap-6">
          {/* Subtle Crest Watermark */}
          <img
            src="/brand/crest-watermark.webp"
            alt=""
            aria-hidden="true"
            width={240}
            height={240}
            loading="lazy"
            decoding="async"
            className="absolute -right-8 -top-8 w-52 h-52 sm:w-60 sm:h-60 object-cover opacity-[0.045] rounded-full pointer-events-none select-none"
          />

          <div className="relative z-10 space-y-4">
            {/* Real Operational Status Row */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold border ${
                  isCriticalNegative
                    ? 'bg-[var(--sentiment-neg-subtle)] border-[var(--sentiment-neg-border)] text-[var(--sentiment-neg)]'
                    : 'bg-[var(--sentiment-pos-subtle)] border-[var(--sentiment-pos-border)] text-[var(--sentiment-pos)]'
                }`}
              >
                {isCriticalNegative ? (
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                )}
                <span>{isCriticalNegative ? 'Perlu Atensi: Sentimen Negatif Tinggi' : 'Kondisi Wacana Stabil Kondusif'}</span>
              </span>

              {dailyBriefing?.window_label && (
                <span className="text-xs text-[var(--text-muted)] font-mono-code font-tabular">
                  {dailyBriefing.window_label}
                </span>
              )}
            </div>

            {/* Editorial Headline & Synthesis */}
            <div className="space-y-2.5">
              <h1 className="font-editorial text-2xl sm:text-[32px] lg:text-[36px] font-medium tracking-tight text-[var(--text-primary)] leading-[1.15] text-balance">
                Ringkasan Situasi Wacana Publik
              </h1>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-[66ch] text-pretty">
                {dailyBriefing?.ai_summary ||
                  'Pemantauan percakapan media nasional dan kanal sosial terhubung sedang aktif untuk memetakan arah sentimen dan lonjakan isu prioritas.'}
              </p>
            </div>

            {/* Direct Action Row */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {onAskAi && (
                <button
                  type="button"
                  onClick={handlePrimaryHeroAction}
                  className="btn-contrast min-h-11 px-5 text-xs sm:text-[13px] inline-flex items-center gap-2"
                >
                  <MessageSquareText className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{topProgram ? `Bedah Isu: ${topProgram.name}` : 'Bedah Ringkasan dengan AI'}</span>
                </button>
              )}

              {topProgram && (
                <span className="text-xs text-[var(--text-muted)] font-tabular">
                  Sorotan terbanyak: <strong className="text-[var(--text-primary)]">{topProgram.mentions.toLocaleString('id-ID')}</strong> sebutan
                </span>
              )}
            </div>
          </div>

          {/* Integrated Ref-1 Style 4-KPI Dock (Flat, Clean, No Nested Box Clutter) */}
          <div className="relative z-10 surface-inset p-4 sm:p-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
              {/* KPI 1 */}
              <div className="min-w-0 space-y-1">
                <div className="text-2xl sm:text-[26px] font-bold text-[var(--text-primary)] font-tabular tracking-tight leading-none">
                  {totalMentions.toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-[var(--text-secondary)] font-medium">Total Sebutan</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold font-tabular pt-0.5">
                  {isPositiveGrowth ? (
                    <TrendingUp className="w-3 h-3 text-[var(--sentiment-pos)] shrink-0" aria-hidden="true" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-[var(--sentiment-neg)] shrink-0" aria-hidden="true" />
                  )}
                  <span className={isPositiveGrowth ? 'text-[var(--sentiment-pos)]' : 'text-[var(--sentiment-neg)]'}>
                    {isPositiveGrowth ? '+' : ''}
                    {changePercent}%
                  </span>
                </div>
              </div>

              {/* KPI 2 */}
              <div className="min-w-0 space-y-1 sm:border-l sm:border-[var(--border-subtle)] sm:pl-4">
                <div className="text-2xl sm:text-[26px] font-bold text-[var(--text-primary)] font-tabular tracking-tight leading-none">
                  {isPositiveGrowth ? `+${changePercent}%` : `${changePercent}%`}
                </div>
                <div className="text-xs text-[var(--text-secondary)] font-medium">Laju Volume</div>
                <div className="text-[11px] text-[var(--text-muted)] pt-0.5 truncate">
                  {isPositiveGrowth ? 'Eskalasi aktif' : 'Volume stabil'}
                </div>
              </div>

              {/* KPI 3 */}
              <div className="min-w-0 space-y-1 sm:border-l sm:border-[var(--border-subtle)] sm:pl-4">
                <div
                  className={`text-2xl sm:text-[26px] font-bold font-tabular tracking-tight leading-none ${
                    isCriticalNegative ? 'text-[var(--sentiment-neg)]' : 'text-[var(--text-primary)]'
                  }`}
                >
                  {negativeSharePercent}%
                </div>
                <div className="text-xs text-[var(--text-secondary)] font-medium">Porsi Negatif</div>
                <div className="w-full h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full ${
                      isCriticalNegative ? 'bg-[var(--sentiment-neg-bar)]' : 'bg-[var(--accent-gold)]'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(4, negativeSharePercent))}%` }}
                  />
                </div>
              </div>

              {/* KPI 4 */}
              <div className="min-w-0 space-y-1 sm:border-l sm:border-[var(--border-subtle)] sm:pl-4">
                <div className="text-2xl sm:text-[26px] font-bold text-[var(--text-primary)] font-tabular tracking-tight leading-none">
                  {risingTopicsCount}
                </div>
                <div className="text-xs text-[var(--text-secondary)] font-medium">Topik Lonjakan</div>
                <div className="text-[11px] text-[var(--accent-gold-text)] font-medium pt-0.5 truncate">
                  Isu berakselerasi
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Companion Studio Card: Smooth 33h Velocity Curve + Unified Sentiment Barometer */}
        <div className="lg:col-span-5 surface-card p-5 sm:p-6 flex flex-col justify-between gap-5">
          {/* Top: Hourly Activity Curve */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm sm:text-[15px] font-semibold text-[var(--text-primary)] tracking-tight">
                  Aktivitas Percakapan 33 Jam Terakhir
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {dailyBriefing
                    ? `${dailyBriefing.total_mentions.toLocaleString('id-ID')} sebutan terekam per jam`
                    : 'Distribusi intensitas percakapan per jam'}
                </p>
              </div>

              {peakVelocity && (
                <div className="px-2.5 py-1 rounded-full bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)] text-[11px] font-semibold font-tabular shrink-0">
                  Puncak {peakVelocity.count}
                </div>
              )}
            </div>

            {velocityData.length > 0 ? (
              <div className="h-44 sm:h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={velocityData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="heroVelocityFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartTokens.goldStroke} stopOpacity={0.32} />
                        <stop offset="95%" stopColor={chartTokens.goldStroke} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="time_label"
                      tick={{ fill: chartTokens.tickFill, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fill: chartTokens.tickFill, fontSize: 10 }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div
                            className="px-3 py-1.5 rounded-full text-xs font-semibold font-tabular shadow-lg border"
                            style={{
                              backgroundColor: chartTokens.tooltipBg,
                              borderColor: chartTokens.tooltipBorder,
                              color: chartTokens.tooltipText,
                            }}
                          >
                            <span>{label}: </span>
                            <span style={{ color: '#DFB84F' }}>{payload[0].value} sebutan</span>
                          </div>
                        );
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={chartTokens.goldStroke}
                      strokeWidth={2.25}
                      fillOpacity={1}
                      fill="url(#heroVelocityFill)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-44 sm:h-48 surface-inset flex items-center justify-center text-xs text-[var(--text-muted)] px-4 text-center">
                Belum ada catatan volume per jam pada jendela 33 jam terakhir.
              </div>
            )}
          </div>

          {/* Bottom: Unified Cumulative Sentiment Barometer */}
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Keseimbangan Sentimen Periode Aktif
              </span>
              <span className="text-xs font-semibold font-tabular text-[var(--sentiment-pos)]">
                {posPct + neuPct}% Kondusif
              </span>
            </div>

            <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[var(--bg-surface-elevated)] gap-0.5">
              <div
                style={{ width: `${posPct}%` }}
                className="h-full bg-[var(--sentiment-pos-bar)] rounded-l-full transition-[width] duration-300"
                title={`Positif: ${posPct}%`}
              />
              <div
                style={{ width: `${neuPct}%` }}
                className="h-full bg-[var(--sentiment-neu-bar)] transition-[width] duration-300"
                title={`Netral: ${neuPct}%`}
              />
              <div
                style={{ width: `${negPct}%` }}
                className="h-full bg-[var(--sentiment-neg-bar)] rounded-r-full transition-[width] duration-300"
                title={`Negatif: ${negPct}%`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-tabular">
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-elevated)]">
                <span className="text-[var(--text-secondary)]">Positif</span>
                <span className="font-bold text-[var(--sentiment-pos)]">{posPct}%</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-elevated)]">
                <span className="text-[var(--text-secondary)]">Netral</span>
                <span className="font-bold text-[var(--text-primary)]">{neuPct}%</span>
              </div>
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[var(--bg-surface-elevated)]">
                <span className="text-[var(--text-secondary)]">Negatif</span>
                <span className="font-bold text-[var(--sentiment-neg)]">{negPct}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Factual Chronology Strip (Clean 3-card row separated from Hero, no nested boxes) */}
      {events.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs sm:text-[13px] font-semibold text-[var(--text-secondary)] inline-flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-gold-text)]" aria-hidden="true" />
              <span>Kronologi Peristiwa Lapangan (33 Jam Terakhir)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {events.slice(0, 3).map((ev) => {
              const sentimentLabel =
                ev.sentiment === 'positive'
                  ? 'Positif'
                  : ev.sentiment === 'negative'
                    ? 'Negatif'
                    : 'Netral';
              const sentimentClass =
                ev.sentiment === 'positive'
                  ? 'bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border-[var(--sentiment-pos-border)]'
                  : ev.sentiment === 'negative'
                    ? 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                    : 'bg-[var(--sentiment-neu-subtle)] text-[var(--sentiment-neu)] border-[var(--sentiment-neu-border)]';

              return (
                <article
                  key={ev.id}
                  className="surface-card surface-card-interactive p-4 sm:p-5 flex flex-col justify-between gap-3.5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono-code font-tabular text-[var(--accent-gold-text)] font-medium">
                        {ev.time_label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold ${sentimentClass}`}>
                        {sentimentLabel}
                      </span>
                    </div>

                    <div className="text-[11px] font-medium text-[var(--text-muted)] truncate">
                      {ev.program_name}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectEventMention?.(ev.id)}
                      className="text-left text-[13px] font-semibold text-[var(--text-primary)] hover:text-[var(--accent-gold-text)] leading-snug line-clamp-2 transition-colors"
                    >
                      {ev.headline}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-subtle)] text-[11px]">
                    <span className="text-[var(--text-muted)] truncate max-w-[130px]">{ev.source}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {onAskAi && (
                        <button
                          type="button"
                          onClick={() =>
                            onAskAi(
                              `Analisis konteks dan dampak peristiwa: "${ev.headline}" pada program ${ev.program_name}`
                            )
                          }
                          className="min-h-8 px-2.5 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] font-medium inline-flex items-center gap-1 transition-colors"
                        >
                          <MessageSquareText className="w-3 h-3 text-[var(--accent-gold-text)]" aria-hidden="true" />
                          <span>Bedah AI</span>
                        </button>
                      )}
                      {ev.url ? (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-8 px-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Sumber</span>
                          <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectEventMention?.(ev.id)}
                          className="min-h-8 px-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] inline-flex items-center gap-1 transition-colors"
                        >
                          <span>Detail</span>
                          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
