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
    <div className="bento-card p-6 bg-[#0e1117] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pb-3.5 border-b border-white/[0.08]">
        <div>
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5 mb-0.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Konstelasi Entitas</span>
          </span>
          <h3 className="font-editorial text-xl font-medium tracking-tight text-white">
            Kata Kunci &amp; Frasa Dominan
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5 font-sans-ui">
            Entitas paling sering disorot dalam narasi berita publik
          </p>
        </div>
      </div>

      {/* Keywords cloud */}
      <div className="flex flex-wrap gap-2.5">
        {keywords.length === 0 ? (
          <div className="text-xs text-zinc-500 py-12 w-full text-center font-sans-ui">
            Belum ada kata kunci diekstraksi dari arus berita
          </div>
        ) : (
          keywords.map((kw, idx) => (
            <button
              key={idx}
              onClick={() => onSelectKeyword(kw.keyword)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.08] hover:border-blue-500/40 text-xs transition-all group shadow-xs cursor-pointer"
            >
              <Hash className="w-3.5 h-3.5 text-blue-400 group-hover:text-blue-300" />
              <span className="text-zinc-200 group-hover:text-white font-semibold font-sans-ui">
                {kw.keyword}
              </span>
              <span className="text-[11px] text-zinc-400 bg-white/[0.05] group-hover:bg-blue-500/20 group-hover:text-blue-300 px-1.5 py-0.5 rounded-md font-mono-code border border-white/[0.06]">
                {kw.count}
              </span>
            </button>
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="text-xs text-zinc-400 mt-5 pt-3.5 border-t border-white/[0.06] flex items-center justify-between font-sans-ui">
        <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
          <Filter className="w-3 h-3 text-zinc-500" />
          <span>Klik entitas untuk memfilter ruang kerja</span>
        </span>
        <span className="text-blue-400 font-mono-code text-[11px]">Filter Instan</span>
      </div>
    </div>
  );
}
