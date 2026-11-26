import { ArrowUpRight, Flame } from 'lucide-react';

interface SampleMentionEvidence {
  id: number;
  provider: string;
  author_name: string;
  text: string;
  sentiment: string;
}

interface RisingTopic {
  id: number;
  name: string;
  description: string | null;
  mentions_count: number;
  trend_score: number;
  sample_count: number;
  explanation: string;
  driving_keywords?: string[];
  active_providers?: string[];
  sample_mention?: SampleMentionEvidence | null;
  components?: {
    volume?: number;
    growth?: number;
    acceleration?: number;
    source_diversity?: number;
    persistence?: number;
    driving_keywords?: string[];
    active_providers?: string[];
    sample_mention?: SampleMentionEvidence | null;
  } | null;
}

interface RisingTopicsCardProps {
  topics: RisingTopic[];
  onSelectTopic: (id: number) => void;
}

export function RisingTopicsCard({ topics, onSelectTopic }: RisingTopicsCardProps) {
  return (
    <section aria-label="Topik dengan akselerasi tercepat" className="surface-card p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-4 mb-4 border-b border-[var(--border-subtle)]">
        <div className="min-w-0">
          <h2 className="font-editorial text-xl font-medium tracking-tight text-[var(--text-primary)]">
            Topik Berakselerasi Tercepat
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Peringkat isu berdasarkan lonjakan volume dan lintas sumber 24 jam terakhir
          </p>
        </div>
        <span className="text-[11px] text-[var(--text-muted)] font-mono-code hidden sm:inline shrink-0 pt-1">
          Skor 0-100
        </span>
      </div>

      {/* Ref 1 & Ref 2 Inspired Pill-Row List */}
      <div className="space-y-3">
        {topics.length === 0 ? (
          <div className="surface-inset px-5 py-10 text-center space-y-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              Belum ada topik melampaui ambang akselerasi
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Coba alihkan lensa ke Semua Isu atau tunggu pembaruan sinkronisasi berikutnya.
            </p>
          </div>
        ) : (
          topics.map((topic, index) => {
            const scorePct = Math.min(100, Math.max(0, topic.trend_score));
            const keywords = topic.driving_keywords ?? topic.components?.driving_keywords ?? [];
            const providers = topic.active_providers ?? topic.components?.active_providers ?? [];
            const sampleMention = topic.sample_mention ?? topic.components?.sample_mention ?? null;
            const isCriticalScore = topic.trend_score >= 75;

            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => onSelectTopic(topic.id)}
                className="pill-row w-full text-left p-4 space-y-2.5 group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="w-6 h-6 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] text-[11px] font-bold font-tabular flex items-center justify-center shrink-0 mt-0.5">
                      {index + 1}
                    </span>
                    <span className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--accent-gold-text)] transition-colors leading-snug">
                      {topic.name}
                    </span>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-tabular shrink-0 inline-flex items-center gap-1 border ${
                      isCriticalScore
                        ? 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                        : 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]'
                    }`}
                  >
                    <Flame className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{topic.trend_score}</span>
                  </span>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed sm:pl-9">
                  {topic.explanation.replace(/—/g, ':')}
                </p>

                {(keywords.length > 0 || providers.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 sm:pl-9">
                    {keywords.slice(0, 4).map((kw) => (
                      <span
                        key={kw}
                        className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)]"
                      >
                        #{kw}
                      </span>
                    ))}
                    {providers.slice(0, 4).map((prov) => (
                      <span
                        key={prov}
                        className="px-2 py-0.5 rounded-lg text-[10px] font-mono-code uppercase bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                      >
                        {prov}
                      </span>
                    ))}
                  </div>
                )}

                {sampleMention && (
                  <p className="text-[11px] text-[var(--text-muted)] italic leading-relaxed border-l-2 border-[var(--accent-gold-border)] sm:ml-9 pl-2.5 line-clamp-2">
                    &ldquo;{sampleMention.text}&rdquo; ({sampleMention.author_name})
                  </p>
                )}

                <div className="sm:pl-9 pt-1 space-y-2">
                  <div className="w-full h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                    <div
                      style={{ width: `${scorePct}%` }}
                      className={`h-full rounded-full ${
                        isCriticalScore ? 'bg-[var(--sentiment-neg-bar)]' : 'bg-[var(--accent-gold)]'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs pt-0.5">
                    <span className="text-[var(--text-muted)] font-tabular">
                      {topic.mentions_count.toLocaleString('id-ID')} sebutan terverifikasi
                    </span>
                    <span className="text-[var(--text-primary)] font-semibold inline-flex items-center gap-1">
                      <span>Telusuri Bukti</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-[var(--accent-gold-text)]" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
