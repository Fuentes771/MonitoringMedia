import { useEffect } from 'react';
import { ExternalLink, X, ShieldCheck, Tag, Calendar, Hash, Sparkles } from 'lucide-react';
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
  // Close on Escape key press (Antislop R-32)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB';
    } catch {
      return iso;
    }
  };

  const confidencePct = mention.sentiment?.confidence
    ? Math.round(mention.sentiment.confidence * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Click outside to close backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="w-full max-w-lg bg-[#0a0c12] border-l border-white/[0.1] h-full overflow-y-auto flex flex-col justify-between shadow-2xl transition-colors font-sans-ui">
        <div>
          {/* Header */}
          <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-[#0e1117]/80 sticky top-0 z-10 backdrop-blur-md">
            <div>
              <div className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400">Inspeksi Sebutan</div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span>Rincian Bukti Percakapan</span>
                <span className="text-xs text-zinc-400 font-mono-code font-medium">#{mention.id}</span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Tutup Panel (Esc)"
              aria-label="Tutup panel detail"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5">
            {/* Metadata Bar */}
            <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Platform Sumber</span>
                <PlatformBadge
                  provider={mention.provider}
                  size="sm"
                  isComment={Boolean(mention.metadata_json?.is_comment)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Penulis / Akun</span>
                <span className="text-zinc-200 font-semibold text-right">
                  {mention.author_name || 'Publik / Anonim'}
                  {mention.metadata_json?.author_handle &&
                    !(mention.author_name || '').toLowerCase().includes(String(mention.metadata_json.author_handle).toLowerCase()) && (
                      <span className="text-zinc-400 font-mono-code font-normal ml-1.5">
                        ({mention.metadata_json.author_handle})
                      </span>
                    )}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Waktu Publikasi</span>
                <span className="text-zinc-300 flex items-center gap-1.5 font-tabular">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{formatTimestamp(mention.published_at)}</span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-zinc-400">Status Tautan</span>
                <LinkVerificationBadge
                  provider={mention.provider}
                  sourceUrl={mention.source_url}
                  linkStatus={mention.link_status || mention.metadata_json?.link_status}
                  isDemo={mention.is_demo}
                  showCopyButton
                />
              </div>

              {(isSocial || mention.metadata_json?.metrics) && (
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.06]">
                  <span className="text-zinc-400">Interaksi Publik</span>
                  <SocialEngagementBar
                    metrics={mention.metadata_json?.metrics}
                    likesFallback={mention.metadata_json?.likes}
                    metricsAvailable={mention.metadata_json?.metrics_available}
                    showUnavailableHint
                  />
                </div>
              )}
            </div>

            {/* NLP Sentiment Analysis Section */}
            <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Hasil Klasifikasi Sentimen NLP</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${mention.sentiment?.label === 'positive'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : mention.sentiment?.label === 'negative'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  }`}>
                  {mention.sentiment?.label === 'positive'
                    ? 'Positif'
                    : mention.sentiment?.label === 'negative'
                      ? 'Negatif'
                      : 'Netral'}
                </span>
              </div>

              {/* Confidence Meter */}
              <div>
                <div className="flex justify-between text-xs text-zinc-400 mb-1.5">
                  <span>Tingkat Keyakinan Model</span>
                  <span className="text-zinc-200 font-bold font-tabular">{confidencePct}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                  <div
                    style={{ width: `${confidencePct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${mention.sentiment?.label === 'positive'
                        ? 'bg-emerald-500'
                        : mention.sentiment?.label === 'negative'
                          ? 'bg-rose-500'
                          : 'bg-zinc-400'
                      }`}
                  />
                </div>
              </div>

              {mention.sentiment?.probabilities_json && (
                <div className="pt-2 border-t border-zinc-800/80 text-xs space-y-1.5">
                  <span className="text-zinc-400 text-[11px]">Distribusi Probabilitas Model:</span>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-emerald-400 font-semibold text-xs block">Positif</span>
                      <span className="text-zinc-200 font-bold font-tabular text-xs">
                        {Math.round(mention.sentiment.probabilities_json.positive * 100)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-zinc-400 font-semibold text-xs block">Netral</span>
                      <span className="text-zinc-200 font-bold font-tabular text-xs">
                        {Math.round(mention.sentiment.probabilities_json.neutral * 100)}%
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-950/80 border border-zinc-800">
                      <span className="text-rose-400 font-semibold text-xs block">Negatif</span>
                      <span className="text-rose-400 font-bold font-tabular text-xs">
                        {Math.round(mention.sentiment.probabilities_json.negative * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sarcasm & Bot Authenticity Telemetry Box */}
            {(mention.is_sarcasm ||
              mention.metadata_json?.sarcasm_analysis?.is_sarcasm ||
              mention.is_inauthentic ||
              mention.metadata_json?.bot_analysis?.is_inauthentic) && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] space-y-3 text-xs">
                  <div className="font-mono-code font-bold uppercase tracking-wider text-[10px] text-amber-300">
                    Deteksi Keaslian Opini &amp; Ironi Politik
                  </div>

                  {(mention.is_sarcasm || mention.metadata_json?.sarcasm_analysis?.is_sarcasm) && (
                    <div className="p-3 rounded-lg bg-[#08090d]/80 border border-amber-500/25 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-amber-300">🎭 Terdeteksi Sarkasme / Satir</span>
                        <span className="font-mono-code text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                          Auto-Flip &rarr; NEGATIF
                        </span>
                      </div>
                      <p className="text-zinc-300 text-[11px] leading-relaxed">
                        {mention.metadata_json?.sarcasm_analysis?.sarcasm_reason ||
                          'Komentar menggunakan pujian ironis untuk menyindir kebijakan publik.'}
                      </p>
                    </div>
                  )}

                  {(mention.is_inauthentic || mention.metadata_json?.bot_analysis?.is_inauthentic) && (
                    <div className="p-3 rounded-lg bg-[#08090d]/80 border border-rose-500/25 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-300">🤖 Terindikasi Amplifikasi Bot / Buzzer</span>
                        <span className="font-mono-code text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
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
                          <ul className="list-disc list-inside text-zinc-300 text-[11px] space-y-0.5">
                            {mention.metadata_json.bot_analysis.bot_signals.map((sig, idx) => (
                              <li key={idx}>{sig}</li>
                            ))}
                          </ul>
                        )}
                    </div>
                  )}
                </div>
              )}

            {/* Full Text Content */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-zinc-300">
                {isSocial ? 'Isi Postingan / Komentar Netizen' : 'Kutipan & Teks Artikel Media'}
              </div>
              <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/60 text-zinc-200 text-xs sm:text-sm leading-relaxed select-text shadow-xs">
                {mention.text}
              </div>
            </div>

            {/* Topics & Keywords Tags */}
            <div className="space-y-3">
              {mention.topics && mention.topics.length > 0 && (
                <div>
                  <div className="text-xs text-zinc-400 mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Topik Terkait</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mention.topics.map((t) => (
                      <span
                        key={t.id}
                        className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-200 border border-zinc-700 font-medium"
                      >
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {mention.keywords && mention.keywords.length > 0 && (
                <div>
                  <div className="text-xs text-zinc-400 mb-2 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Kata Kunci Terdeteksi</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mention.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-xs px-2.5 py-1 rounded-full bg-zinc-900 text-zinc-300 border border-zinc-800"
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

        {/* Footer Actions */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 sticky bottom-0 space-y-2.5">
          {onAskAi && (
            <button
              type="button"
              onClick={() => onAskAi(mention)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-bold text-xs transition-all shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-zinc-950" />
              <span>Tanyakan ke AI / Analisis Isu Ini</span>
            </button>
          )}

          {linkInfo.isExternalNavigable && linkInfo.href ? (
            <a
              href={linkInfo.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-xs transition-colors shadow-xs ${linkInfo.isSearchFallback
                  ? 'bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-200'
                  : 'bg-white hover:bg-zinc-200 text-zinc-950'
                }`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>
                {linkInfo.isSearchFallback
                  ? 'Cari Postingan Terkait di Platform'
                  : isSocial
                    ? 'Buka Postingan Asli'
                    : 'Buka Tautan Artikel Asli'}
              </span>
            </a>
          ) : (
            <div className="p-2.5 text-center text-xs text-zinc-400 bg-zinc-900/60 rounded-lg border border-zinc-800">
              {linkInfo.reason}
            </div>
          )}

          <div className="flex items-center justify-center gap-1.5 text-xs text-zinc-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{linkInfo.isVerifiedDirect ? 'Tautan Terverifikasi pada Sumber Publik' : linkInfo.reason}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
