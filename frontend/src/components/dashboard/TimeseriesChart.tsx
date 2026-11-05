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

interface TimeseriesChartProps {
  timeline: TimelinePoint[];
}

export function TimeseriesChart({ timeline }: TimeseriesChartProps) {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [metricMode, setMetricMode] = useState<'sentiment' | 'total'>('sentiment');

  return (
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Aktivitas Percakapan & Tren Sentimen
          </h2>
          <p className="text-xs text-slate-400">
            Distribusi volume percakapan harian berdasarkan klasifikasi model NLP
          </p>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setMetricMode('sentiment')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                metricMode === 'sentiment'
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Komposisi Sentimen
            </button>
            <button
              onClick={() => setMetricMode('total')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                metricMode === 'total'
                  ? 'bg-slate-800 text-slate-100 font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Volume Total
            </button>
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                chartType === 'area'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Area
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                chartType === 'bar'
                  ? 'bg-indigo-600 text-white font-medium'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bar
            </button>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 sm:h-72 w-full">
        {timeline.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs">
            Tidak ada data untuk periode ini.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNeu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorTot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs space-y-1">
                          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1">
                            {label}
                          </div>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                <span>{entry.name}:</span>
                              </span>
                              <span className="font-semibold text-white">{entry.value}</span>
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
                    <Area type="monotone" dataKey="positive" name="Positif" stroke="#10b981" fillOpacity={1} fill="url(#colorPos)" strokeWidth={2} />
                    <Area type="monotone" dataKey="neutral" name="Netral" stroke="#64748b" fillOpacity={1} fill="url(#colorNeu)" strokeWidth={2} />
                    <Area type="monotone" dataKey="negative" name="Negatif" stroke="#f43f5e" fillOpacity={1} fill="url(#colorNeg)" strokeWidth={2} />
                  </>
                ) : (
                  <Area type="monotone" dataKey="total" name="Total Mentions" stroke="#6366f1" fillOpacity={1} fill="url(#colorTot)" strokeWidth={2} />
                )}
              </AreaChart>
            ) : (
              <BarChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-slate-700/80 p-3 rounded-lg shadow-xl text-xs space-y-1">
                          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1 mb-1">
                            {label}
                          </div>
                          {payload.map((entry, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                                <span>{entry.name}:</span>
                              </span>
                              <span className="font-semibold text-white">{entry.value}</span>
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
                    <Bar dataKey="neutral" name="Netral" fill="#64748b" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="negative" name="Negatif" fill="#f43f5e" radius={[4, 4, 0, 0]} stackId="a" />
                  </>
                ) : (
                  <Bar dataKey="total" name="Total Mentions" fill="#6366f1" radius={[4, 4, 0, 0]} />
                )}
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Legend & Tooltip Explanation */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 mt-2 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Positif
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span> Netral
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> Negatif
          </span>
        </div>

        <div className="text-[11px] text-slate-500">
          *Estimasi otomatis berdasarkan model NLP hybrid Bahasa Indonesia
        </div>
      </div>
    </div>
  );
}
