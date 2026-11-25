import {
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Radio,
  Activity,
  CalendarClock,
  Clock,
  ExternalLink,
  Zap,
  Sparkles,
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
  const isPositiveGrowth = changePercent >= 0;
  const isCriticalNegative = negativeSharePercent > 25;
  const totalSentiment = positiveCount + neutralCount + negativeCount;

  const posPct = totalSentiment > 0 ? Math.round((positiveCount / totalSentiment) * 100) : 0;
  const neuPct = totalSentiment > 0 ? Math.round((neutralCount / totalSentiment) * 100) : 0;
  const negPct = totalSentiment > 0 ? Math.round((negativeCount / totalSentiment) * 100) : 0;

  const velocityData = dailyBriefing?.hourly_velocity || [];
  const events = dailyBriefing?.chronological_events || [];

  return (
    <div className="bento-card p-4 sm:p-6 lg:p-8 bg-[#0c0f16] relative overflow-hidden">
      {/* Ambient Telemetry Backdrop */}
      <div
        aria-hidden="true"
        className="absolute right-0 top-0 bottom-0 w-full md:w-3/4 bg-cover bg-right md:bg-center pointer-events-none opacity-30 sm:opacity-35"
        style={{ backgroundImage: `url('/brand/ambient-backdrop.webp')` }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#0c0f16] via-[#0c0f16]/85 to-transparent pointer-events-none" />

      {/* Heraldic Watermark Seal in Background */}
      <img
        src="/brand/crest-watermark.webp"
        alt=""
        aria-hidden="true"
        width={288}
        height={288}
        loading="lazy"
        decoding="async"
        className="absolute -right-8 -bottom-10 w-52 h-52 sm:w-72 sm:h-72 object-cover opacity-[0.07] rounded-full pointer-events-none select-none"
      />

      {/* Header Eyebrow & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 mb-4 sm:mb-5 relative z-10">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center shrink-0">
            <img
              src="/brand/trinetra-logo.svg"
              alt="TRINETRA Emblem"
              width={40}
              height={40}
              className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(212,175,55,0.45)]"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10.5px] sm:text-[11px] font-mono-code font-semibold tracking-wider uppercase">
                <Radio className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                <span>Executive Intelligence Briefing</span>
              </span>
              <span className="text-[11px] text-zinc-400 font-sans-ui hidden md:inline">
                Sintesis Pemantauan 17 Program Prioritas Nasional
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 font-mono-code mt-0.5 truncate">
              DATA TERVERIFIKASI &bull; TRINETRA SYSTEM
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono-code text-[11px] font-semibold border ${
            isCriticalNegative
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isCriticalNegative ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            <span>{isCriticalNegative ? 'Status: Risiko Kritis' : 'Status: Stabil Kondusif'}</span>
          </span>
        </div>
      </div>

      {/* Executive Daily Briefing (00:00 Kemarin s/d 09:00 WIB Hari Ini) */}
      {dailyBriefing && (
        <div className="relative z-10 mb-4 sm:mb-6 p-3.5 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/30 via-[#12151c] to-zinc-900/40 border border-amber-500/25 shadow-lg shadow-black/40 space-y-3.5 sm:space-y-4">
          {/* Top Row: Window Label & Quick KPIs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 border-b border-white/10">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/30 shrink-0">
                <CalendarClock className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
                <span className="text-xs font-bold text-white tracking-wide uppercase">
                  Ringkasan Harian Intelijen
                </span>
                <span className="text-[11px] text-amber-300 font-mono-code px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  {dailyBriefing.window_label}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              <span className="text-xs text-zinc-400">Total Sebutan:</span>
              <span className="text-xs sm:text-sm font-bold font-mono-code font-tabular text-amber-300 px-2.5 py-0.5 rounded-lg bg-amber-400/10 border border-amber-400/25">
                {dailyBriefing.total_mentions.toLocaleString('id-ID')} sebutan
              </span>
            </div>
          </div>

          {/* AI-Generated Daily Executive Synthesis */}
          {dailyBriefing.ai_summary && (
            <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-amber-950/25 via-zinc-900/50 to-black/40 border border-amber-500/20 relative overflow-hidden shadow-sm">
              <div className="flex items-center gap-2 mb-1.5 text-amber-300 text-xs font-bold tracking-wide uppercase font-mono-code">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                <span>Sintesis Intelijen AI (33 Jam)</span>
              </div>
              <p className="text-[12.5px] sm:text-[13px] text-zinc-200 leading-relaxed font-sans-ui text-pretty">
                {dailyBriefing.ai_summary}
              </p>
            </div>
          )}

          {/* Grid: Hourly Velocity Chart (Left) & Sentiment Barometer (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-5 items-center">
            {/* Left: Hourly Velocity Curve */}
            <div className="lg:col-span-7 p-3 rounded-xl bg-black/40 border border-white/[0.08] space-y-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Kurva Aktivitas Jam-ke-Jam (33 Jam)</span>
                </span>
                <span className="text-[10px] text-zinc-400 font-mono-code">
                  Puncak sebutan terpetakan
                </span>
              </div>

              {velocityData.length > 0 ? (
                <div className="h-28 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={velocityData} margin={{ top: 5, right: 16, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#d4af37" stopOpacity={0.55} />
                          <stop offset="95%" stopColor="#d4af37" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="time_label"
                        tick={{ fill: '#a1a1aa', fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        minTickGap={22}
                      />
                      <YAxis
                        tick={{ fill: '#a1a1aa', fontSize: 9 }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0c0e14',
                          borderColor: 'rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          fontSize: '11px',
                          color: '#fff',
                        }}
                        formatter={(val: any) => [`${val} sebutan`, 'Volume']}
                        labelStyle={{ color: '#e6ca65', fontWeight: 600 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#d4af37"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#velocityGradient)"
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-xs text-zinc-400 font-mono-code">
                  Menunggu data sebutan periode ini...
                </div>
              )}
            </div>

            {/* Right: Sentiment Split & Top Focus */}
            <div className="lg:col-span-5 p-3.5 rounded-xl bg-black/40 border border-white/[0.08] space-y-3 min-w-0">
              <div className="flex items-center justify-between gap-2 text-xs font-mono-code">
                <span className="text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                  Distribusi Sentimen
                </span>
                <span className="text-amber-300 text-[11px] font-bold font-tabular">
                  {dailyBriefing.pos_percent}% Positif
                </span>
              </div>

              {/* Progress Stack */}
              <div className="w-full h-3 bg-white/[0.05] rounded-full overflow-hidden flex border border-white/10">
                <div style={{ width: `${dailyBriefing.pos_percent}%` }} className="h-full bg-emerald-500" title={`Positif: ${dailyBriefing.pos_percent}% (${dailyBriefing.positive})`} />
                <div style={{ width: `${dailyBriefing.neu_percent}%` }} className="h-full bg-zinc-500" title={`Netral: ${dailyBriefing.neu_percent}% (${dailyBriefing.neutral})`} />
                <div style={{ width: `${dailyBriefing.neg_percent}%` }} className="h-full bg-rose-500" title={`Negatif: ${dailyBriefing.neg_percent}% (${dailyBriefing.negative})`} />
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[10.5px] font-mono-code font-tabular pt-1">
                <div className="p-1.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                  Pos: {dailyBriefing.positive}
                </div>
                <div className="p-1.5 rounded bg-white/5 border border-white/10 text-zinc-200">
                  Net: {dailyBriefing.neutral}
                </div>
                <div className="p-1.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">
                  Neg: {dailyBriefing.negative}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-zinc-400 text-[11px] shrink-0">Fokus Isu Terbanyak:</span>
                {dailyBriefing.top_programs.slice(0, 1).map((tp) => (
                  <button
                    key={tp.id}
                    type="button"
                    onClick={() => onAskAi?.(`Analisis mendalam persepsi publik, isu kunci, dan dinamika sentimen pada program prioritas ${tp.name}`, tp.id)}
                    className="min-h-10 sm:min-h-8 w-full sm:w-auto sm:max-w-[210px] font-semibold text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-amber-500/20 border border-white/10 hover:border-amber-500/40 text-[11px] flex items-center justify-center sm:justify-start gap-1.5 cursor-pointer transition-colors"
                    title={`Klik untuk menganalisis ${tp.name} dengan AI`}
                  >
                    <Sparkles className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">{tp.name} ({tp.mentions})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kronologi Kejadian Nyata yang Terjadi (Factual Chronicle) */}
          {events.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <div className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider font-mono-code flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                <span>Kronologi Peristiwa Lapangan (33 Jam Terakhir)</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {events.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectEventMention?.(ev.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectEventMention?.(ev.id);
                      }
                    }}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/30 transition-all text-xs space-y-2 flex flex-col justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-400 mb-1">
                        <span className="font-mono-code text-amber-300">{ev.time_label}</span>
                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[9px] shrink-0 ${
                          ev.sentiment === 'positive'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : ev.sentiment === 'negative'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-200'
                        }`}>
                          {ev.sentiment}
                        </span>
                      </div>

                      <div className="text-[10.5px] font-semibold text-zinc-400 font-mono-code mb-1 truncate">
                        {ev.program_name}
                      </div>

                      <p className="text-[12.5px] text-white font-medium line-clamp-2 leading-snug group-hover:text-amber-200 transition-colors">
                        {ev.headline}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[10.5px] text-zinc-400 border-t border-white/5">
                      <span className="truncate max-w-[130px]">{ev.source}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        {onAskAi && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAskAi(`Analisis konteks dan dampak peristiwa: "${ev.headline}" pada program ${ev.program_name}`);
                            }}
                            title="Tanyakan AI tentang kronologi ini"
                            className="min-h-8 px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/25 flex items-center gap-1 text-[10.5px] font-mono-code cursor-pointer transition-colors"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" aria-hidden="true" />
                            <span>Tanya AI</span>
                          </button>
                        )}
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="min-h-8 px-2 py-1 rounded-md text-zinc-300 hover:text-amber-300 flex items-center gap-1"
                          >
                            <span>Link</span>
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Proportional Polarity Barometer (Keseluruhan Window Aktif) */}
      <div className="relative z-10 mb-4 sm:mb-6 p-3.5 sm:p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 text-xs mb-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 font-mono-code">
            Barometer Keseimbangan Sentimen Kumulatif
          </span>
          <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs font-mono-code font-tabular">
            <span className="text-emerald-400 font-semibold">{posPct}% Positif</span>
            <span className="text-zinc-300 font-semibold">{neuPct}% Netral</span>
            <span className="text-rose-400 font-semibold">{negPct}% Negatif</span>
          </div>
        </div>

        {/* Visual Progress Stack */}
        <div className="w-full h-2.5 bg-white/[0.05] rounded-full overflow-hidden flex p-0.5 border border-white/[0.08]">
          <div
            style={{ width: `${posPct}%` }}
            className="h-full bg-emerald-500 rounded-l-full transition-all duration-500 shadow-sm shadow-emerald-500/50"
            title={`Positif: ${posPct}%`}
          />
          <div
            style={{ width: `${neuPct}%` }}
            className="h-full bg-zinc-600 transition-all duration-500"
            title={`Netral: ${neuPct}%`}
          />
          <div
            style={{ width: `${negPct}%` }}
            className="h-full bg-rose-500 rounded-r-full transition-all duration-500 shadow-sm shadow-rose-500/50"
            title={`Negatif: ${negPct}%`}
          />
        </div>
      </div>

      {/* Integrated Metrics Dock */}
      <div className="relative z-10 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 pt-4 sm:pt-5 border-t border-white/[0.08]">
        {/* Metric 1: Total Mentions */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-code block mb-1 truncate">
            Total Sebutan
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white font-mono-code font-tabular tracking-tight">
            {totalMentions.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span className={`inline-flex items-center gap-0.5 font-semibold text-[11px] font-mono-code font-tabular ${
              isPositiveGrowth ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {isPositiveGrowth ? <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" /> : <TrendingDown className="w-3 h-3 shrink-0" aria-hidden="true" />}
              <span>{isPositiveGrowth ? '+' : ''}{changePercent}%</span>
            </span>
            <span className="text-zinc-400 text-[10px]">vs periode lalu</span>
          </div>
        </div>

        {/* Metric 2: Momentum Velocity */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-code block mb-1 truncate">
            Laju Pertumbuhan
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white font-mono-code font-tabular tracking-tight">
            {isPositiveGrowth ? `+${changePercent}%` : `${changePercent}%`}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
            <Activity className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="text-[11px] truncate">{isPositiveGrowth ? 'Eskalasi aktif' : 'Volume stabil'}</span>
          </div>
        </div>

        {/* Metric 3: Critical Negative Share */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-code block mb-1 truncate">
            Risiko Negatif
          </span>
          <div className={`text-xl sm:text-2xl lg:text-3xl font-extrabold font-mono-code font-tabular tracking-tight ${
            isCriticalNegative ? 'text-rose-400' : 'text-white'
          }`}>
            {negativeSharePercent}%
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {isCriticalNegative ? (
              <span className="text-rose-400 text-[11px] flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Di atas batas 25%</span>
              </span>
            ) : (
              <span className="text-emerald-400 text-[11px] flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span className="truncate">Kondusif terkelola</span>
              </span>
            )}
          </div>
        </div>

        {/* Metric 4: Active Escalating Topics */}
        <div className="p-3 sm:p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono-code block mb-1 truncate">
            Topik Lonjakan
          </span>
          <div className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white font-mono-code font-tabular tracking-tight flex items-baseline gap-1.5">
            <span>{risingTopicsCount}</span>
            <span className="text-[11px] sm:text-xs font-normal text-zinc-400 font-sans-ui">Isu Aktif</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-400 font-medium">
            <Flame className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="text-[11px] truncate">Atensi proaktif</span>
          </div>
        </div>
      </div>
    </div>
  );
}
