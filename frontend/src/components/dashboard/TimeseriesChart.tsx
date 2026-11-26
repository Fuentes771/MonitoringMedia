import { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TimelinePoint } from '@/lib/api';
import { useTheme } from '@/hooks/useTheme';
import { BarChart3, LineChart, Calendar } from 'lucide-react';

interface TimeseriesChartProps {
  timeline: TimelinePoint[];
}

export function TimeseriesChart({ timeline }: TimeseriesChartProps) {
  const { chartTokens } = useTheme();
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [metricMode, setMetricMode] = useState<'sentiment' | 'total'>('sentiment');

  const totalVolume = timeline.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const avgDaily = timeline.length > 0 ? Math.round(totalVolume / timeline.length) : 0;
  const peakPoint = timeline.reduce<TimelinePoint | null>((max, curr) => {
    if (!max || curr.total > max.total) return curr;
    return max;
  }, null);

  const totalPos = timeline.reduce((acc, curr) => acc + (curr.positive || 0), 0);
  const totalNeu = timeline.reduce((acc, curr) => acc + (curr.neutral || 0), 0);
  const positiveRatio = totalVolume > 0 ? Math.round(((totalPos + totalNeu) / totalVolume) * 100) : 0;

  const renderTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: ReadonlyArray<{ name?: string; value?: number; color?: string }>;
    label?: string | number;
  }) => {
    if (!active || !payload?.length) return null;
    return (
      <div
        className="p-3.5 rounded-2xl shadow-xl text-xs space-y-2 min-w-[190px] border"
        style={{
          backgroundColor: chartTokens.tooltipBg,
          borderColor: chartTokens.tooltipBorder,
          color: chartTokens.tooltipText,
        }}
      >
        <div
          className="font-semibold pb-1.5 flex items-center gap-1.5 font-mono-code text-[11px] border-b"
          style={{ borderColor: chartTokens.tooltipBorder }}
        >
          <Calendar className="w-3.5 h-3.5 text-[#DFB84F]" aria-hidden="true" />
          <span>{label}</span>
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2" style={{ color: chartTokens.tooltipMuted }}>
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span>{entry.name}</span>
            </span>
            <span className="font-bold font-tabular">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section aria-label="Fluktuasi volume dan sentimen harian" className="surface-card p-5 sm:p-6 lg:p-7">
      {/* Clean Header Row (No uppercase mono eyebrow) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-5 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <h2 className="font-editorial text-xl sm:text-2xl font-medium tracking-tight text-[var(--text-primary)] leading-tight">
            Fluktuasi Volume &amp; Sentimen Harian
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Perbandingan tren percakapan positif, netral, dan negatif berdasarkan hari publikasi
          </p>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full md:w-auto shrink-0">
          <div
            role="group"
            aria-label="Mode metrik grafik"
            className="inline-flex items-center p-1 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex-1 sm:flex-none"
          >
            <button
              type="button"
              onClick={() => setMetricMode('sentiment')}
              aria-pressed={metricMode === 'sentiment'}
              className={`min-h-9 sm:min-h-8 flex-1 sm:flex-none px-3.5 rounded-full text-xs font-semibold transition-colors ${
                metricMode === 'sentiment'
                  ? 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Sentimen
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('total')}
              aria-pressed={metricMode === 'total'}
              className={`min-h-9 sm:min-h-8 flex-1 sm:flex-none px-3.5 rounded-full text-xs font-semibold transition-colors ${
                metricMode === 'total'
                  ? 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Total Volume
            </button>
          </div>

          <div
            role="group"
            aria-label="Jenis tampilan grafik"
            className="inline-flex items-center p-1 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] shrink-0"
          >
            <button
              type="button"
              onClick={() => setChartType('area')}
              aria-label="Tampilan grafik kurva area"
              aria-pressed={chartType === 'area'}
              className={`min-w-9 min-h-9 sm:min-w-8 sm:min-h-8 flex items-center justify-center rounded-full transition-colors ${
                chartType === 'area'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <LineChart className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('bar')}
              aria-label="Tampilan diagram batang"
              aria-pressed={chartType === 'bar'}
              className={`min-w-9 min-h-9 sm:min-w-8 sm:min-h-8 flex items-center justify-center rounded-full transition-colors ${
                chartType === 'bar'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BarChart3 className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-60 sm:h-72 lg:h-80 w-full">
        {timeline.length === 0 ? (
          <div className="h-full surface-inset flex flex-col items-center justify-center text-center px-6 gap-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Belum ada deret waktu pada periode ini
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Coba perluas rentang waktu di kanan atas (7 Hari atau 30 Hari) atau jalankan sinkronisasi sumber data.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="tsPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.posStroke} stopOpacity={0.24} />
                    <stop offset="100%" stopColor={chartTokens.posStroke} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="tsNeu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.neuStroke} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={chartTokens.neuStroke} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="tsNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.negStroke} stopOpacity={0.24} />
                    <stop offset="100%" stopColor={chartTokens.negStroke} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="tsTot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartTokens.goldStroke} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={chartTokens.goldStroke} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={chartTokens.gridStroke} strokeDasharray="3 4" />
                <XAxis
                  dataKey="label"
                  stroke={chartTokens.axisStroke}
                  tick={{ fill: chartTokens.tickFill, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={26}
                />
                <YAxis
                  stroke={chartTokens.axisStroke}
                  tick={{ fill: chartTokens.tickFill, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={renderTooltip} />
                {metricMode === 'sentiment' ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="positive"
                      name="Positif"
                      stroke={chartTokens.posStroke}
                      strokeWidth={2.2}
                      fill="url(#tsPos)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="neutral"
                      name="Netral"
                      stroke={chartTokens.neuStroke}
                      strokeWidth={1.8}
                      fill="url(#tsNeu)"
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="negative"
                      name="Negatif"
                      stroke={chartTokens.negStroke}
                      strokeWidth={2.2}
                      fill="url(#tsNeg)"
                      isAnimationActive={false}
                    />
                  </>
                ) : (
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Sebutan"
                    stroke={chartTokens.goldStroke}
                    strokeWidth={2.5}
                    fill="url(#tsTot)"
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            ) : (
              <BarChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={chartTokens.gridStroke} strokeDasharray="3 4" />
                <XAxis
                  dataKey="label"
                  stroke={chartTokens.axisStroke}
                  tick={{ fill: chartTokens.tickFill, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={26}
                />
                <YAxis
                  stroke={chartTokens.axisStroke}
                  tick={{ fill: chartTokens.tickFill, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={renderTooltip} />
                {metricMode === 'sentiment' ? (
                  <>
                    <Bar dataKey="positive" name="Positif" fill={chartTokens.posStroke} radius={[4, 4, 0, 0]} stackId="a" isAnimationActive={false} />
                    <Bar dataKey="neutral" name="Netral" fill={chartTokens.neuStroke} radius={[4, 4, 0, 0]} stackId="a" isAnimationActive={false} />
                    <Bar dataKey="negative" name="Negatif" fill={chartTokens.negStroke} radius={[4, 4, 0, 0]} stackId="a" isAnimationActive={false} />
                  </>
                ) : (
                  <Bar dataKey="total" name="Total Sebutan" fill={chartTokens.goldStroke} radius={[6, 6, 0, 0]} isAnimationActive={false} />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Clean Analytical Footnote Strip & Legend */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 mt-5 border-t border-[var(--border-subtle)] text-xs">
        <div>
          <span className="text-[var(--text-muted)] block">Puncak Harian</span>
          <span className="font-semibold text-[var(--text-primary)] font-tabular mt-0.5 block">
            {peakPoint ? `${peakPoint.label} (${peakPoint.total.toLocaleString('id-ID')} sebutan)` : 'Belum ada data'}
          </span>
        </div>

        <div className="sm:border-l sm:border-[var(--border-subtle)] sm:pl-4">
          <span className="text-[var(--text-muted)] block">Rata-rata Harian</span>
          <span className="font-semibold text-[var(--text-primary)] font-tabular mt-0.5 block">
            {avgDaily.toLocaleString('id-ID')} sebutan / hari
          </span>
        </div>

        <div className="sm:border-l sm:border-[var(--border-subtle)] sm:pl-4">
          <span className="text-[var(--text-muted)] block">Stabilitas Kondusif</span>
          <span className="font-semibold text-[var(--sentiment-pos)] font-tabular mt-0.5 block">
            {positiveRatio}% Positif &amp; Netral
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-4 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--sentiment-pos-bar)]" aria-hidden="true" />
            <span>Positif</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--sentiment-neu-bar)]" aria-hidden="true" />
            <span>Netral</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--sentiment-neg-bar)]" aria-hidden="true" />
            <span>Negatif</span>
          </span>
        </div>
        <span className="font-mono-code text-[11px]">IndoBERT + Slang Lexicon ID</span>
      </div>
    </section>
  );
}
