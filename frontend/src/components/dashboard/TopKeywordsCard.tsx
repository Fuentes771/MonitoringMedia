import { Hash, Sparkles } from 'lucide-react';

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
    <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-bold text-white tracking-tight">
            Kata Kunci Dominan Terkini
          </h2>
        </div>
        <span className="text-[11px] text-slate-400">
          Ekstraksi Unigram & Bigram
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {keywords.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 w-full text-center">
            Belum ada kata kunci diekstraksi dari data terkini.
          </div>
        ) : (
          keywords.map((kw, idx) => (
            <button
              key={idx}
              onClick={() => onSelectKeyword(kw.keyword)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-slate-700 text-xs transition-colors group"
            >
              <Hash className="w-3 h-3 text-indigo-400" />
              <span className="text-slate-300 group-hover:text-white font-medium">
                {kw.keyword}
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded font-mono">
                {kw.count}
              </span>
            </button>
          ))
        )}
      </div>

      <div className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-800/60">
        Klik kata kunci untuk melihat daftar cuplikan mention pendukung.
      </div>
    </div>
  );
}
