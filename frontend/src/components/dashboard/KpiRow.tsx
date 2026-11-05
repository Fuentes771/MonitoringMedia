import { MessageSquare, TrendingUp, AlertCircle, Sparkles } from 'lucide-react';

interface KpiRowProps {
  totalMentions: number;
  changePercent: number;
  negativeSharePercent: number;
  risingTopicsCount: number;
}

export function KpiRow({
  totalMentions,
  changePercent,
  negativeSharePercent,
  risingTopicsCount,
}: KpiRowProps) {
  const isPositiveGrowth = changePercent >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Total Mentions */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Total Percakapan</span>
          <MessageSquare className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {totalMentions.toLocaleString('id-ID')}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span className={isPositiveGrowth ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
              {isPositiveGrowth ? '+' : ''}{changePercent}%
            </span>
            <span>dibanding periode lalu</span>
          </div>
        </div>
      </div>

      {/* 2. Pertumbuhan Volume */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Momentum Tren</span>
          <TrendingUp className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-white tracking-tight">
            {isPositiveGrowth ? `+${changePercent}%` : `${changePercent}%`}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {isPositiveGrowth ? 'Volume percakapan meningkat' : 'Aktivitas stabil / melambat'}
          </div>
        </div>
      </div>

      {/* 3. Proporsi Negatif */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Proporsi Sentimen Negatif</span>
          <AlertCircle className="w-4 h-4 text-rose-400" />
        </div>
        <div>
          <div className={`text-2xl font-bold tracking-tight ${negativeSharePercent > 25 ? 'text-rose-400' : 'text-slate-200'}`}>
            {negativeSharePercent}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {negativeSharePercent > 25 ? 'Perlu perhatian khusus' : 'Kondisi sentimen terkendali'}
          </div>
        </div>
      </div>

      {/* 4. Topik Sedang Naik */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-400 text-xs font-medium mb-2">
          <span>Topik Meningkat</span>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-400 tracking-tight">
            {risingTopicsCount} Topik
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Melewati ambang momentum pertumbuhan
          </div>
        </div>
      </div>
    </div>
  );
}
