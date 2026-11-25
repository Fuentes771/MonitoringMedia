import { Hash, Sparkles, Filter } from 'lucide-react';

interface TopKeyword {
  keyword: string;
  count: number;
  avg_score: number | string;
}

interface TopKeywordsCardProps {
  keywords: TopKeyword[];
  onSelectKeyword: (kw: string) => void;
}

export function TopKeywordsCard({ keywords, onSelectKeyword }: TopKeywordsCardProps) {
  return (
    <div className="bento-card p-4 sm:p-6 bg-[#0e1117] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-5 pb-3.5 border-b border-white/[0.08]">
        <div>
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Konstelasi Entitas</span>
          </span>
          <h3 className="font-editorial text-lg sm:text-xl font-medium tracking-tight text-white">
            Kata Kunci &amp; Frasa Dominan
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-sans-ui">
            Entitas paling sering disorot dalam narasi berita publik
          </p>
        </div>
      </div>

      {/* Keywords cloud */}
      <div className="flex flex-wrap gap-2">
        {keywords.length === 0 ? (
          <div className="text-xs text-zinc-400 py-10 sm:py-12 w-full text-center font-sans-ui">
            Belum ada kata kunci diekstraksi dari arus berita
          </div>
        ) : (
          keywords.map((kw, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectKeyword(kw.keyword)}
              className="min-h-11 sm:min-h-9 flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.08] active:bg-white/[0.12] hover:border-amber-500/40 text-xs transition-all group shadow-xs cursor-pointer"
            >
              <Hash className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-300 shrink-0" aria-hidden="true" />
              <span className="text-zinc-200 group-hover:text-white font-semibold font-sans-ui">
                {kw.keyword}
              </span>
              <span className="text-[11px] text-zinc-300 bg-white/[0.05] group-hover:bg-amber-500/20 group-hover:text-amber-300 px-1.5 py-0.5 rounded-md font-mono-code font-tabular border border-white/[0.06]">
                {kw.count}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="text-xs text-zinc-400 mt-4 sm:mt-5 pt-3.5 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 font-sans-ui">
        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
          <span>Ketuk entitas untuk memfilter sebutan</span>
        </span>
        <span className="text-amber-400 font-mono-code text-[11px]">Filter Instan</span>
      </div>
    </div>
  );
}
