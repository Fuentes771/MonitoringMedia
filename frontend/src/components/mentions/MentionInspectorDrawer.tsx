import { useEffect } from 'react';
import {
  ExternalLink,
  X,
  ShieldCheck,
  Tag,
  Calendar,
  Hash,
  MessageSquareText,
  Copy,
  Activity,
} from 'lucide-react';
import { MentionItem } from '@/lib/api';
import { PlatformBadge, SocialEngagementBar, isSocialProvider } from '@/components/common/PlatformBadge';
import { LinkVerificationBadge } from '@/components/common/LinkVerificationBadge';
import { inspectSocialLink } from '@/utils/socialLink';

interface MentionInspectorDrawerProps {
  mention: MentionItem | null;
  onClose: () => void;
  onAskAi?: (mention: MentionItem) => void;
}

export function MentionInspectorDrawer({ mention, onClose, onAskAi }: MentionInspectorDrawerProps) {
  // Close on Escape key press & lock body scroll while open (R-32)
  useEffect(() => {
    if (!mention) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mention, onClose]);

  if (!mention) return null;

  const isSocial = isSocialProvider(mention.provider);
  const linkInfo = inspectSocialLink({
    provider: mention.provider,
    sourceUrl: mention.source_url,
    linkStatus: mention.link_status || mention.metadata_json?.link_status,
    isDemo: mention.is_demo,
  });

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return (
        d.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }) + ' WIB'
      );
    } catch {
      return iso;
    }
  };

  const confidencePct = mention.sentiment?.confidence
    ? Math.round(mention.sentiment.confidence * 100)
    : 0;

  const hasAuthenticityFlags =
    mention.is_sarcasm ||
    mention.metadata_json?.sarcasm_analysis?.is_sarcasm ||
    mention.is_inauthentic ||
    mention.metadata_json?.bot_analysis?.is_inauthentic ||
    mention.is_near_duplicate ||
    mention.metadata_json?.is_near_duplicate ||
    mention.bot_cluster_id;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[var(--bg-backdrop)] backdrop-blur-xs">
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rincian bukti percakapan"
        className="w-full max-w-lg bg-[var(--bg-surface)] border-l border-[var(--border-medium)] h-dvh overflow-y-auto overscroll-y-contain flex flex-col justify-between shadow-[var(--shadow-elevated)] font-sans-ui"
      >
        <div>
          {/* Sticky Header */}
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--bg-surface)] sticky top-0 z-10">
            <div className="min-w-0">
              <h2 className="font-editorial text-lg font-medium text-[var(--text-primary)] flex items-center gap-2 truncate">
                <span className="truncate">Rincian Bukti Percakapan</span>
                <span className="text-xs text-[var(--text-muted)] font-mono-code font-normal shrink-0">
                  #{mention.id}
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              title="Tutup panel (Esc)"
              aria-label="Tutup panel detail"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 space-y-5">
            {/* Full Text Content First (Primary Evidence) */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[var(--text-secondary)]">
                {isSocial ? 'Isi Postingan / Komentar Netizen' : 'Kutipan & Teks Artikel Media'}
              </div>
              <div className="surface-inset p-4 text-[var(--text-primary)] text-sm leading-relaxed select-text">
                {mention.text}
              </div>
            </div>

            {/* Metadata Provenance */}
            <div className="surface-inset p-4 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">Platform Sumber</span>
                <PlatformBadge
                  provider={mention.provider}
                  size="sm"
                  isComment={Boolean(mention.metadata_json?.is_comment)}
                  ingestionSource={mention.ingestion_source || mention.metadata_json?.ingestion_source}
                />
              </div>

              {(mention.ingestion_source ||
                mention.metadata_json?.ingestion_source ||
                mention.metadata_json?.raw_source) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[var(--text-muted)]">Saluran Ingesti</span>
                  <span className="text-[var(--text-primary)] font-mono-code text-[11px] text-right">
                    {mention.metadata_json?.raw_source
                      ? `${mention.ingestion_source || mention.metadata_json?.ingestion_source || 'muse-connector'} (${mention.metadata_json.raw_source})`
                      : mention.ingestion_source || mention.metadata_json?.ingestion_source}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--text-muted)] shrink-0">Penulis / Akun</span>
                <span className="text-[var(--text-primary)] font-semibold text-right break-words min-w-0">
                  {mention.metadata_json?.author_profile_url ? (
                    <a
                      href={mention.metadata_json.author_profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--text-primary)] hover:text-[var(--accent-gold-text)] underline underline-offset-2 transition-colors"
                    >
                      {mention.author_name || 'Publik / Anonim'}
                    </a>
                  ) : (
                    mention.author_name || 'Publik / Anonim'
                  )}
                  {mention.metadata_json?.author_handle &&
                    !(mention.author_name || '')
                      .toLowerCase()
                      .includes(String(mention.metadata_json.author_handle).toLowerCase()) && (
                      <span className="text-[var(--text-muted)] font-mono-code font-normal ml-1.5">
                        ({mention.metadata_json.author_handle})
                      </span>
                    )}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">Waktu Publikasi</span>
                <span className="text-[var(--text-primary)] flex items-center gap-1.5 font-tabular">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                  <span>{formatTimestamp(mention.published_at)}</span>
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[var(--text-muted)]">Status Tautan</span>
                <LinkVerificationBadge
                  provider={mention.provider}
                  sourceUrl={mention.source_url}
                  linkStatus={mention.link_status || mention.metadata_json?.link_status}
                  isDemo={mention.is_demo}
                  showCopyButton
                />
              </div>

              {(isSocial || mention.metadata_json?.metrics) && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)]">Interaksi Publik</span>
                  <SocialEngagementBar
                    metrics={mention.metadata_json?.metrics}
                    likesFallback={mention.metadata_json?.likes}
                    metricsAvailable={mention.metadata_json?.metrics_available}
                    showUnavailableHint
                  />
                </div>
              )}
            </div>

            {/* NLP Sentiment Classification */}
            <div className="surface-inset p-4 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[var(--accent-gold-text)]" aria-hidden="true" />
                  <span>Klasifikasi Sentimen NLP</span>
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${
                    mention.sentiment?.label === 'positive'
                      ? 'bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border-[var(--sentiment-pos-border)]'
                      : mention.sentiment?.label === 'negative'
                        ? 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                        : 'bg-[var(--sentiment-neu-subtle)] text-[var(--sentiment-neu)] border-[var(--sentiment-neu-border)]'
                  }`}
                >
                  {mention.sentiment?.label === 'positive'
                    ? 'Positif'
                    : mention.sentiment?.label === 'negative'
                      ? 'Negatif'
                      : 'Netral'}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1.5">
                  <span>Tingkat Keyakinan Model</span>
                  <span className="text-[var(--text-primary)] font-bold font-tabular">{confidencePct}%</span>
                </div>
                <div className="w-full h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden">
                  <div
                    style={{ width: `${confidencePct}%` }}
                    className={`h-full rounded-full transition-[width] duration-300 ${
                      mention.sentiment?.label === 'positive'
                        ? 'bg-[var(--sentiment-pos-bar)]'
                        : mention.sentiment?.label === 'negative'
                          ? 'bg-[var(--sentiment-neg-bar)]'
                          : 'bg-[var(--sentiment-neu-bar)]'
                    }`}
                  />
                </div>
              </div>

              {mention.sentiment?.probabilities_json && (
                <div className="pt-2.5 border-t border-[var(--border-subtle)] text-xs space-y-2">
                  <span className="text-[var(--text-muted)] text-[11px] block">
                    Probabilitas Model:
                  </span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <span className="text-[var(--sentiment-pos)] font-semibold text-xs block">Positif</span>
                      <span className="text-[var(--text-primary)] font-bold font-tabular text-xs">
                        {Math.round(mention.sentiment.probabilities_json.positive * 100)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <span className="text-[var(--text-secondary)] font-semibold text-xs block">Netral</span>
                      <span className="text-[var(--text-primary)] font-bold font-tabular text-xs">
                        {Math.round(mention.sentiment.probabilities_json.neutral * 100)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                      <span className="text-[var(--sentiment-neg)] font-semibold text-xs block">Negatif</span>
                      <span className="text-[var(--sentiment-neg)] font-bold font-tabular text-xs">
                        {Math.round(mention.sentiment.probabilities_json.negative * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {(mention.metadata_json?.ai_analysis?.key_reason ||
                mention.metadata_json?.ai_analysis?.aspect ||
                mention.metadata_json?.ai_analysis?.urgency) && (
                <div className="pt-2.5 border-t border-[var(--border-subtle)] space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {mention.metadata_json.ai_analysis.aspect && (
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
                        Aspek: {mention.metadata_json.ai_analysis.aspect}
                      </span>
                    )}
                    {mention.metadata_json.ai_analysis.urgency && (
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[11px] font-semibold text-[var(--accent-gold-text)]">
                        Urgensi: {mention.metadata_json.ai_analysis.urgency}
                      </span>
                    )}
                  </div>
                  {mention.metadata_json.ai_analysis.key_reason && (
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      <strong className="text-[var(--text-primary)] font-semibold">Catatan Analisis:</strong>{' '}
                      {mention.metadata_json.ai_analysis.key_reason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Authenticity / Sarcasm / Bot Flags */}
            {hasAuthenticityFlags && (
              <div className="p-4 rounded-2xl border border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)] space-y-3 text-xs">
                <div className="font-semibold text-[var(--accent-gold-text)]">
                  Deteksi Keaslian Opini &amp; Sarkasme
                </div>

                {(mention.is_near_duplicate ||
                  mention.metadata_json?.is_near_duplicate ||
                  mention.bot_cluster_id) && (
                  <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-[var(--accent-gold-text)]" aria-hidden="true" />
                      <span>
                        {mention.bot_cluster_id
                          ? `Anggota Klaster Copypasta #${mention.bot_cluster_id}`
                          : 'Terdeteksi sebagai Duplikat Serupa'}
                      </span>
                    </span>
                    {(mention.near_duplicate_of_id || mention.metadata_json?.near_duplicate_of_id) && (
                      <p className="text-[var(--text-secondary)] text-[11px]">
                        Merujuk dokumen utama #{mention.near_duplicate_of_id || mention.metadata_json?.near_duplicate_of_id}.
                      </p>
                    )}
                  </div>
                )}

                {(mention.is_sarcasm || mention.metadata_json?.sarcasm_analysis?.is_sarcasm) && (
                  <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-semibold text-[var(--accent-gold-text)]">
                        Terdeteksi Sarkasme / Satir
                      </span>
                      <span className="text-[10.5px] px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)] font-semibold">
                        Auto-Flip ke Negatif
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)] text-[11px] leading-relaxed">
                      {mention.metadata_json?.sarcasm_analysis?.sarcasm_reason ||
                        'Komentar menggunakan pujian ironis untuk menyindir kebijakan publik.'}
                    </p>
                  </div>
                )}

                {(mention.is_inauthentic || mention.metadata_json?.bot_analysis?.is_inauthentic) && (
                  <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--sentiment-neg-border)] space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="font-semibold text-[var(--sentiment-neg)]">
                        Terindikasi Amplifikasi Bot / Buzzer
                      </span>
                      <span className="font-tabular text-[10.5px] px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] font-bold">
                        Skor Bot:{' '}
                        {Math.round(
                          (mention.inauthentic_score ??
                            mention.metadata_json?.bot_analysis?.inauthentic_score ??
                            0.7) * 100
                        )}
                        %
                      </span>
                    </div>
                    {mention.metadata_json?.bot_analysis?.bot_signals &&
                      mention.metadata_json.bot_analysis.bot_signals.length > 0 && (
                        <ul className="list-disc list-inside text-[var(--text-secondary)] text-[11px] space-y-0.5">
                          {mention.metadata_json.bot_analysis.bot_signals.map((sig, idx) => (
                            <li key={idx}>{sig}</li>
                          ))}
                        </ul>
                      )}
                  </div>
                )}
              </div>
            )}

            {/* Topics & Keywords */}
            <div className="space-y-3">
              {mention.topics && mention.topics.length > 0 && (
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Topik Terkait</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mention.topics.map((t) => (
                      <span
                        key={t.id}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-medium"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {mention.keywords && mention.keywords.length > 0 && (
                <div>
                  <div className="text-xs text-[var(--text-muted)] mb-2 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Kata Kunci Terdeteksi</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mention.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-lg bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] font-medium"
                      >
                        #{kw.keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] sticky bottom-0 space-y-2.5">
          {onAskAi && (
            <button
              type="button"
              onClick={() => onAskAi(mention)}
              className="btn-gold w-full min-h-11 px-4 text-xs inline-flex items-center justify-center gap-2"
            >
              <MessageSquareText className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Bedah Isu Ini dengan Asisten AI</span>
            </button>
          )}

          {linkInfo.isExternalNavigable && linkInfo.href ? (
            <a
              href={linkInfo.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full min-h-11 px-4 text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors ${
                linkInfo.isSearchFallback
                  ? 'rounded-full border border-[var(--accent-gold-border)] bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] hover:opacity-90'
                  : 'btn-contrast'
              }`}
            >
              <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {linkInfo.isSearchFallback
                  ? 'Cari Postingan Terkait di Platform'
                  : isSocial
                    ? 'Buka Postingan Asli'
                    : 'Buka Tautan Artikel Asli'}
              </span>
            </a>
          ) : (
            <div className="p-2.5 text-center text-xs text-[var(--text-muted)] surface-inset">
              {linkInfo.reason}
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)] text-center">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--sentiment-pos)] shrink-0" aria-hidden="true" />
            <span>{linkInfo.isVerifiedDirect ? 'Tautan Terverifikasi pada Sumber Publik' : linkInfo.reason}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
