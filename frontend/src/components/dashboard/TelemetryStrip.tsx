import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck, Flame, Radio, Activity } from 'lucide-react';

interface TelemetryStripProps {
  totalMentions: number;
  changePercent: number;
  negativeSharePercent: number;
  risingTopicsCount: number;
  positiveCount?: number;
  neutralCount?: number;
}

export function TelemetryStrip({
  totalMentions,
  changePercent,
  negativeSharePercent,
  risingTopicsCount,
}: TelemetryStripProps) {
  const isPositiveGrowth = changePercent >= 0;
  const isCriticalNegative = negativeSharePercent > 25;

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xs backdrop-blur-xs transition-colors mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/80">
        
        {/* Cell 1: Total Volume Sebutan */}
        <div className="p-5 flex flex-col justify-between hover:bg-zinc-800/20 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Total Sebutan Dipantau
            </span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Ingest</span>
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-zinc-100 font-tabular">
              {totalMentions.toLocaleString('id-ID')}
            </div>
            <div className="mt-2.5 flex items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-xs ${
                isPositiveGrowth 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {isPositiveGrowth ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span className="font-tabular">{isPositiveGrowth ? '+' : ''}{changePercent}%</span>
              </span>
              <span className="text-zinc-400 text-[11px]">vs periode lalu</span>
            </div>
          </div>
        </div>

        {/* Cell 2: Laju Momentum Tren */}
        <div className="p-5 flex flex-col justify-between hover:bg-zinc-800/20 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Akselerasi Pertumbuhan
            </span>
            <div className="w-6 h-6 rounded-md bg-zinc-800/80 text-zinc-300 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-zinc-100 font-tabular">
              {isPositiveGrowth ? `+${changePercent}%` : `${changePercent}%`}
            </div>
            <div className="mt-2.5 text-xs text-zinc-400 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isPositiveGrowth ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              <span className="text-[11px]">
                {isPositiveGrowth ? 'Arus percakapan bertumbuh' : 'Aktivitas percakapan stabil'}
              </span>
            </div>
          </div>
        </div>

        {/* Cell 3: Rasio Sentimen Negatif */}
        <div className="p-5 flex flex-col justify-between hover:bg-zinc-800/20 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Rasio Sentimen Negatif
            </span>
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
              isCriticalNegative ? 'bg-rose-500/10 text-rose-400' : 'bg-zinc-800/80 text-zinc-300'
            }`}>
              {isCriticalNegative ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            </div>
          </div>
          <div>
            <div className={`text-3xl font-extrabold tracking-tight font-tabular ${
              isCriticalNegative ? 'text-rose-400' : 'text-zinc-100'
            }`}>
              {negativeSharePercent}%
            </div>
            <div className="mt-2.5 text-xs">
              {isCriticalNegative ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-medium text-[11px]">
                  Ambang batas kritis (&gt; 25%)
                </span>
              ) : (
                <span className="text-zinc-400 flex items-center gap-1.5 text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Kondisi sentimen terkendali</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cell 4: Topik Lonjakan Aktif */}
        <div className="p-5 flex flex-col justify-between hover:bg-zinc-800/20 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Topik Lonjakan Aktif
            </span>
            <div className="w-6 h-6 rounded-md bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Flame className="w-3.5 h-3.5" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold tracking-tight text-zinc-100 font-tabular">
              {risingTopicsCount} <span className="text-sm font-medium text-zinc-400">Isu</span>
            </div>
            <div className="mt-2.5 text-xs text-zinc-400 flex items-center gap-1.5 text-[11px]">
              <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>Memerlukan mitigasi proaktif</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
