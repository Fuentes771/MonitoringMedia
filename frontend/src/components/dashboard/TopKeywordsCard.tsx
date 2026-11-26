import { Hash } from 'lucide-react';

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
    <section aria-label="Kata kunci dan frasa dominan" className="surface-card p-5 sm:p-6">
      {/* Header */}
      <div className="pb-4 mb-4 border-b border-[var(--border-subtle)]">
        <h2 className="font-editorial text-xl font-medium tracking-tight text-[var(--text-primary)]">
          Kata Kunci Dominan
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Ketuk frasa untuk langsung memfilter bukti sebutan terkait
        </p>
      </div>

      {/* Keywords */}
      <div className="flex flex-wrap gap-2">
        {keywords.length === 0 ? (
          <div className="surface-inset w-full px-4 py-10 text-center space-y-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Belum ada frasa terekstraksi
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Kata kunci muncul otomatis setelah dokumen berita dan media sosial tersinkronisasi.
            </p>
          </div>
        ) : (
          keywords.map((kw, idx) => (
            <button
              key={`${kw.keyword}-${idx}`}
              type="button"
              onClick={() => onSelectKeyword(kw.keyword)}
              className="min-h-11 sm:min-h-9 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--accent-gold-border)] text-xs transition-colors group"
            >
              <Hash
                className="w-3.5 h-3.5 text-[var(--accent-gold-text)] shrink-0"
                aria-hidden="true"
              />
              <span className="text-[var(--text-primary)] font-semibold">{kw.keyword}</span>
              <span className="text-[11px] font-tabular font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-md border border-[var(--border-subtle)]">
                {kw.count}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
