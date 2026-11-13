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
import { BarChart3, LineChart, Calendar, TrendingUp, Compass, Shield } from 'lucide-react';

interface TimeseriesChartProps {
  timeline: TimelinePoint[];
}

export function TimeseriesChart({ timeline }: TimeseriesChartProps) {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [metricMode, setMetricMode] = useState<'sentiment' | 'total'>('sentiment');

  // Compute derived analytical metrics
  const totalVolume = timeline.reduce((acc, curr) => acc + (curr.total || 0), 0);
  const avgDaily = timeline.length > 0 ? Math.round(totalVolume / timeline.length) : 0;
  const peakPoint = timeline.reduce<TimelinePoint | null>((max, curr) => {
    if (!max || curr.total > max.total) return curr;
    return max;
  }, null);

  const totalPos = timeline.reduce((acc, curr) => acc + (curr.positive || 0), 0);
  const totalNeu = timeline.reduce((acc, curr) => acc + (curr.neutral || 0), 0);
  const positiveRatio = totalVolume > 0 ? Math.round(((totalPos + totalNeu) / totalVolume) * 100) : 0;

  return (
    <div className="bento-card p-6 sm:p-7 bg-[#0e1117] transition-all">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/[0.08]">
        <div>
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400 block mb-0.5">
            Dinamika Telemetri
          </span>
          <h2 className="font-editorial text-xl sm:text-2xl font-medium tracking-tight text-white leading-tight">
            Kronologi Percakapan &amp; Fluktuasi Sentimen
          </h2>
          <p className="text-xs text-zinc-400 mt-1 font-sans-ui">
            Pemetaan volume harian berdasarkan klasifikasi sentimen publik berita Indonesia
          </p>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-2">
          {/* Sentiment vs Total */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-0.5 text-xs shadow-xs">
            <button
              onClick={() => setMetricMode('sentiment')}
              className={`px-3 py-1.5 rounded-lg transition-all font-sans-ui text-xs font-semibold ${
                metricMode === 'sentiment'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Polaritas Sentimen
            </button>
            <button
              onClick={() => setMetricMode('total')}
              className={`px-3 py-1.5 rounded-lg transition-all font-sans-ui text-xs font-semibold ${
                metricMode === 'total'
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Total Akumulatif
            </button>
          </div>

          {/* Area vs Bar */}
          <div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-0.5 text-xs shadow-xs">
            <button
              onClick={() => setChartType('area')}
              aria-label="Tampilan Garis Area"
              className={`p-1.5 rounded-lg transition-all ${
                chartType === 'area'
                  ? 'bg-white/[0.1] text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Grafik Luminous Area"
            >
              <LineChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              aria-label="Tampilan Diagram Batang"
              className={`p-1.5 rounded-lg transition-all ${
                chartType === 'bar'
                  ? 'bg-white/[0.1] text-white shadow-xs'
                  : 'text-zinc-400 hover:text-white'
              }`}
              title="Histogram Kolom"
            >
              <BarChart3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-68 sm:h-76 w-full">
        {timeline.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-xs font-sans-ui">
            Belum ada data untuk rentang waktu yang dipilih
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="areaNeu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#71717a" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#71717a" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="areaNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="areaTot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4af37" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d4af37" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  stroke="#474d5a"
                  tick={{ fill: '#828a99', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#474d5a"
                  tick={{ fill: '#828a99', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#0a0c12]/95 border border-white/[0.12] p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[200px] backdrop-blur-xl">
                          <div className="font-semibold text-white border-b border-white/[0.08] pb-1.5 flex items-center gap-1.5 font-mono-code text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            <span>{label}</span>
                          </div>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                              <span className="flex items-center gap-2" style={{ color: entry.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="font-medium font-sans-ui">{entry.name}:</span>
                              </span>
                              <span className="font-bold text-white font-mono-code">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {metricMode === 'sentiment' ? (
                  <>
                    <Area
                      type="monotone"
                      dataKey="positive"
                      name="Positif"
                      stroke="#10b981"
                      strokeWidth={2.2}
                      fill="url(#areaPos)"
                    />
                    <Area
                      type="monotone"
                      dataKey="neutral"
                      name="Netral"
                      stroke="#71717a"
                      strokeWidth={2}
                      fill="url(#areaNeu)"
                    />
                    <Area
                      type="monotone"
                      dataKey="negative"
                      name="Negatif"
                      stroke="#f43f5e"
                      strokeWidth={2.2}
                      fill="url(#areaNeg)"
                    />
                  </>
                ) : (
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total Sebutan"
                    stroke="#d4af37"
                    strokeWidth={2.5}
                    fill="url(#areaTot)"
                  />
                )}
              </AreaChart>
            ) : (
              <BarChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  stroke="#474d5a"
                  tick={{ fill: '#828a99', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#474d5a"
                  tick={{ fill: '#828a99', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  tickLine={false}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[#0a0c12]/95 border border-white/[0.12] p-3.5 rounded-xl shadow-2xl text-xs space-y-2 min-w-[200px] backdrop-blur-xl">
                          <div className="font-semibold text-white border-b border-white/[0.08] pb-1.5 flex items-center gap-1.5 font-mono-code text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            <span>{label}</span>
                          </div>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                              <span className="flex items-center gap-2" style={{ color: entry.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="font-medium font-sans-ui">{entry.name}:</span>
                              </span>
                              <span className="font-bold text-white font-mono-code">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {metricMode === 'sentiment' ? (
                  <>
                    <Bar dataKey="positive" name="Positif" fill="#10b981" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="neutral" name="Netral" fill="#71717a" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="negative" name="Negatif" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                  </>
                ) : (
                  <Bar dataKey="total" name="Total Sebutan" fill="#d4af37" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Integrated Analytical Footnotes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 mt-3 border-t border-white/[0.08]">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider font-mono-code">
              Puncak Sebutan
            </span>
            <span className="font-semibold text-white font-mono-code text-xs">
              {peakPoint ? `${peakPoint.label} (${peakPoint.total} sebutan)` : 'Menunggu data'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
          <div className="w-7 h-7 rounded-lg bg-white/[0.05] text-zinc-300 border border-white/[0.1] flex items-center justify-center shrink-0">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider font-mono-code">
              Rata-rata Harian
            </span>
            <span className="font-semibold text-white font-mono-code text-xs">
              ~{avgDaily} sebutan / hari
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-zinc-400 block tracking-wider font-mono-code">
              Stabilitas Sentimen
            </span>
            <span className="font-semibold text-emerald-400 font-mono-code text-xs">
              {positiveRatio}% Kondusif / Netral
            </span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 mt-3 border-t border-white/[0.06] text-xs text-zinc-400">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
            <span className="text-zinc-200 font-medium text-[11px] font-sans-ui">Sentimen Positif</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-500 inline-block" />
            <span className="text-zinc-200 font-medium text-[11px] font-sans-ui">Sentimen Netral</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-500/50" />
            <span className="text-zinc-200 font-medium text-[11px] font-sans-ui">Sentimen Negatif</span>
          </span>
        </div>

        <div className="text-[11px] text-zinc-400 flex items-center gap-1.5 font-mono-code">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Model: Multilingual Indobert + Slang Lexicon ID</span>
        </div>
      </div>
    </div>
  );
}
