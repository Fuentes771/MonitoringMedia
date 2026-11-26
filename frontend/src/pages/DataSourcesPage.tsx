import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ConnectorStatus, LivePreviewResponse } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Rss,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Activity,
  Cpu,
  Database,
  Eye,
} from 'lucide-react';
import { PlatformBadge, PlatformIcon, SocialEngagementBar } from '@/components/common/PlatformBadge';
import { LinkVerificationBadge } from '@/components/common/LinkVerificationBadge';

export function DataSourcesPage() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const [activeModalProvider, setActiveModalProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: string;
    status: string;
    message: string;
    latencyMs?: number;
  } | null>(null);

  const [previewData, setPreviewData] = useState<LivePreviewResponse | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [activePreviewProvider, setActivePreviewProvider] = useState<string | null>(null);
  const [previewQuery, setPreviewQuery] = useState('Makan Bergizi Gratis');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewData) setPreviewData(null);
        else if (activeModalProvider) setActiveModalProvider(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewData, activeModalProvider]);

  const handleLivePreview = async (provider: string, customQuery?: string) => {
    setActivePreviewProvider(provider);
    setIsPreviewLoading(true);
    const targetQuery = customQuery || previewQuery || 'Makan Bergizi Gratis';
    try {
      const res = await api.post<LivePreviewResponse>(`/connectors/${provider}/live-preview`, {
        workspace_id: workspaceId,
        query: targetQuery,
      });
      setPreviewData(res.data);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { message?: string } } };
      setTestResult({
        provider,
        status: 'failed',
        message: errObj?.response?.data?.message || 'Gagal melakukan live preview penarikan data.',
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const { data: connectors, isLoading } = useQuery({
    queryKey: ['connectors-list', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ data: ConnectorStatus[] }>('/connectors', {
        params: { workspace_id: workspaceId },
      });
      return res.data.data;
    },
  });

  const saveCredentialsMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const res = await api.post(`/connectors/${provider}/credentials`, {
        workspace_id: workspaceId,
        api_key: apiKey,
      });
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['connectors-list'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      const prov = activeModalProvider || 'rapidapi';
      setActiveModalProvider(null);
      setApiKeyInput('');
      setTestResult({
        provider: prov,
        status: 'success',
        message: `Kredensial API untuk ${prov.toUpperCase()} berhasil disimpan secara terenkripsi.`,
      });
      setTimeout(() => setTestResult(null), 5000);
    },
  });

  const testConnection = async (provider: string) => {
    setTestingProvider(provider);
    const start = performance.now();
    try {
      const res = await api.post(`/connectors/${provider}/test`, { workspace_id: workspaceId });
      const duration = Math.round(performance.now() - start);
      setTestResult({
        provider,
        status: res.data.status,
        message: res.data.message,
        latencyMs: duration,
      });
    } catch {
      setTestResult({
        provider,
        status: 'failed',
        message: 'Koneksi gagal atau endpoint tidak merespons.',
      });
    } finally {
      setTestingProvider(null);
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  const getProviderMeta = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'rss':
        return {
          title: 'Media Berita Indonesia (RSS & Atom Feeds)',
          desc: 'Pengumpulan otomatis multi-query dari portal berita terverifikasi (Google News ID, Antara News, Detik, Tempo, Kompas).',
          sources: ['Google News Indonesia', 'Kompas.com', 'Detik.com', 'Tempo.co', 'Antara News'],
        };
      case 'youtube':
        return {
          title: 'YouTube Data API v3 & Public Stream',
          desc: 'Pencarian video publik, metadata channel, dan komentar netizen melalui YouTube Data API v3 atau ekstraksi publik.',
          sources: ['YouTube Search Endpoint', 'Video Metadata', 'Comments Public Stream'],
        };
      case 'x':
      case 'twitter':
        return {
          title: 'Twitter / X (RapidAPI Hub)',
          desc: 'Pengumpulan percakapan publik, wacana opini, berita terkini, dan balasan teratas netizen.',
          sources: ['X Search Stream', 'Top Replies', 'Trending Hashtags'],
        };
      case 'tiktok':
        return {
          title: 'TikTok Video & Comment Stream',
          desc: 'Pemantauan video tren publik Indonesia beserta klasifikasi sentimen komentar teratas.',
          sources: ['TikTok Feed Search', 'Top Comments', 'Video Metrics'],
        };
      case 'threads':
        return {
          title: 'Threads Publik (via Muse)',
          desc: 'Pencarian percakapan publik per topik di Threads melalui konektor resmi Muse CLI ke endpoint ingest TRINETRA.',
          sources: ['Muse threads-cli search', 'Postingan & Balasan Publik', 'POST /api/v1/ingest/mentions'],
        };
      case 'instagram':
        return {
          title: 'Instagram Publik (via Muse)',
          desc: 'Pengumpulan postingan, Reels, dan komentar publik Instagram melalui konektor resmi Muse dan daftar pantau terverifikasi.',
          sources: ['Muse instagram-cli', 'Public Posts & Reels', 'POST /api/v1/ingest/mentions'],
        };
      case 'facebook':
        return {
          title: 'Facebook Publik (via Muse)',
          desc: 'Pemantauan postingan, komentar, dan reaksi publik Facebook melalui konektor resmi Muse.',
          sources: ['Muse facebook-cli', 'Postingan & Komentar Publik', 'POST /api/v1/ingest/mentions'],
        };
      case 'reddit':
        return {
          title: 'Reddit Developer Platform',
          desc: 'Pengumpulan diskusi forum dan subreddit publik sesuai ketentuan Reddit Developer Terms.',
          sources: ['r/indonesia', 'Subreddit Publik Terverifikasi'],
        };
      default:
        return {
          title: provider.toUpperCase(),
          desc: 'Sumber data digital eksternal terhubung.',
          sources: ['External Source Feed'],
        };
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return 'Belum disinkron';
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
  };

  const connectedCount = connectors?.filter((c) => c.status === 'connected').length ?? 0;

  return (
    <div className="space-y-6 font-sans-ui animate-surface-enter">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--text-primary)] tracking-tight">
            Konektor Sumber Data &amp; Pipeline Ingesti
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Status transparan konektor resmi, pengujian koneksi langsung, dan manajemen kredensial API.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveModalProvider('rapidapi')}
            className="btn-gold flex-1 sm:flex-none min-h-11 px-4 text-xs inline-flex items-center justify-center gap-2"
          >
            <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Setup RapidAPI Hub</span>
          </button>

          <div className="inline-flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-tabular">
            <span className="w-2 h-2 rounded-full bg-[var(--sentiment-pos-bar)] shrink-0" aria-hidden="true" />
            <span className="text-[var(--text-secondary)]">
              <strong className="text-[var(--text-primary)]">{connectedCount}</strong> konektor aktif
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline Overview Strip (Clean Matte, No Fabricated SLA) */}
      <section aria-label="Alur pipeline ingesti" className="surface-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] inline-flex items-center gap-2">
            <Activity className="w-4 h-4 text-[var(--accent-gold-text)]" aria-hidden="true" />
            <span>Alur Pipeline Ingesti Data</span>
          </h2>
          <span className="text-xs text-[var(--text-muted)]">Ingesti &rarr; Klasifikasi NLP &rarr; Indeks Tren</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="surface-inset p-4 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Rss className="w-4 h-4 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
              <span>Multi-Source Collectors</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Penarikan berkala lintas portal berita dan kanal sosial dengan deduplikasi otomatis berbasis hash tautan.
            </p>
          </div>

          <div className="surface-inset p-4 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Cpu className="w-4 h-4 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
              <span>IndoBERT Sentiment &amp; Slang</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Layanan FastAPI NLP memproses sentimen positif, netral, negatif, sarkasme, dan ekstraksi kata kunci dominan.
            </p>
          </div>

          <div className="surface-inset p-4 space-y-1.5">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <Database className="w-4 h-4 text-[var(--sentiment-pos)] shrink-0" aria-hidden="true" />
              <span>PostgreSQL &amp; Trend Snapshots</span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Penyimpanan terindeks dengan perhitungan skor momentum tren (0-100) serta evaluasi ambang peringatan dini.
            </p>
          </div>
        </div>
      </section>

      {/* Connection Test Result Banner */}
      {testResult && (
        <div
          role="status"
          className={`p-4 rounded-2xl border text-xs flex items-center justify-between gap-3 font-medium ${
            testResult.status === 'success' || testResult.status === 'connected'
              ? 'bg-[var(--sentiment-pos-subtle)] border-[var(--sentiment-pos-border)] text-[var(--sentiment-pos)]'
              : testResult.status === 'needs_config'
                ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)] text-[var(--accent-gold-text)]'
                : 'bg-[var(--sentiment-neg-subtle)] border-[var(--sentiment-neg-border)] text-[var(--sentiment-neg)]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {testResult.status === 'success' || testResult.status === 'connected' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            )}
            <span className="break-words">
              <strong className="capitalize">{testResult.provider}:</strong> {testResult.message}
              {testResult.latencyMs !== undefined && (
                <span className="ml-2 font-mono-code font-tabular px-2 py-0.5 rounded-md bg-[var(--bg-surface)] text-[var(--text-primary)]">
                  {testResult.latencyMs}ms
                </span>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="min-w-9 min-h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] shrink-0"
            aria-label="Tutup pesan hasil uji"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Connectors List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3" role="status" aria-label="Memuat konektor sumber data">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 surface-card animate-pulse" />
            ))}
          </div>
        ) : (
          connectors?.map((conn) => {
            const meta = getProviderMeta(conn.provider);
            const isConnected = conn.status === 'connected';
            const isNeedsConfig = conn.status === 'needs_config';
            const isTesting = testingProvider === conn.provider;
            const extConn = conn as ConnectorStatus & {
              engine_mode?: string;
              has_local_engine?: boolean;
              has_rapidapi?: boolean;
              has_credentials?: boolean;
            };

            return (
              <article key={conn.id} className="surface-card p-5 sm:p-6 space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                      <PlatformIcon provider={conn.provider} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-editorial text-lg sm:text-xl font-medium text-[var(--text-primary)]">
                          {meta.title}
                        </h2>
                        <span
                          className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold border ${
                            isConnected
                              ? 'bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border-[var(--sentiment-pos-border)]'
                              : isNeedsConfig
                                ? 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]'
                                : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                          }`}
                        >
                          {isConnected ? 'Terhubung' : isNeedsConfig ? 'Perlu Konfigurasi' : 'Nonaktif'}
                        </span>
                        {extConn.engine_mode === 'muse_push' && (
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            Muse Push
                          </span>
                        )}
                        {extConn.has_local_engine && (
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)]">
                            Ekstraksi Publik
                          </span>
                        )}
                        {extConn.has_rapidapi && (
                          <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                            RapidAPI Aktif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0 flex-wrap">
                    {['x', 'tiktok', 'youtube'].includes(conn.provider) && (
                      <button
                        type="button"
                        onClick={() => void handleLivePreview(conn.provider)}
                        disabled={isPreviewLoading}
                        className="min-h-10 px-3.5 rounded-xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[var(--accent-gold-text)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50"
                      >
                        <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {isPreviewLoading && activePreviewProvider === conn.provider
                            ? 'Mengambil Data...'
                            : 'Live Preview'}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void testConnection(conn.provider)}
                      disabled={isTesting}
                      className="btn-ghost-surface min-h-10 px-3.5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Activity
                        className={`w-3.5 h-3.5 shrink-0 text-[var(--accent-gold-text)] ${isTesting ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>

                    {conn.provider === 'youtube' && (
                      <button
                        type="button"
                        onClick={() => setActiveModalProvider(conn.provider)}
                        className="btn-contrast min-h-10 px-4 text-xs inline-flex items-center justify-center gap-1.5"
                      >
                        <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{extConn.has_credentials ? 'Ubah Kunci API' : 'Pasang Kunci API'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-sources */}
                <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2">
                  <span className="text-xs font-semibold text-[var(--text-secondary)] block">
                    Saluran Terverifikasi
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {meta.sources.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Capability Matrix */}
                <div className="pt-4 border-t border-[var(--border-subtle)] grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="surface-inset p-3 space-y-1">
                    <span className="text-[11px] text-[var(--text-muted)] block">Pencarian Kata Kunci</span>
                    <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sentiment-pos)]" aria-hidden="true" />
                      <span>Didukung</span>
                    </span>
                  </div>

                  <div className="surface-inset p-3 space-y-1">
                    <span className="text-[11px] text-[var(--text-muted)] block">Akses Konten</span>
                    <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-[var(--sentiment-pos)]" aria-hidden="true" />
                      <span>Publik Resmi</span>
                    </span>
                  </div>

                  <div className="surface-inset p-3 space-y-1">
                    <span className="text-[11px] text-[var(--text-muted)] block">Metode Pengumpulan</span>
                    <span className="font-semibold text-[var(--text-primary)] block">
                      {conn.provider === 'rss'
                        ? 'RSS / Atom Feeds'
                        : extConn.engine_mode === 'muse_push'
                          ? 'Muse Official CLI Push'
                          : 'API Resmi + Publik'}
                    </span>
                  </div>

                  <div className="surface-inset p-3 space-y-1">
                    <span className="text-[11px] text-[var(--text-muted)] block">Sinkronisasi Terakhir</span>
                    <span className="font-semibold text-[var(--text-secondary)] font-mono-code font-tabular block">
                      {formatTimestamp(conn.last_successful_sync_at)}
                    </span>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Credentials Modal */}
      {activeModalProvider && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg-backdrop)] backdrop-blur-xs p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Konfigurasi Kredensial API"
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-3xl sm:rounded-3xl border border-[var(--border-medium)] bg-[var(--bg-surface)] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-4 shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
              <h2 className="font-editorial text-lg font-medium text-[var(--text-primary)] truncate">
                {activeModalProvider === 'rapidapi'
                  ? 'Unified RapidAPI Hub (X, TikTok)'
                  : activeModalProvider === 'youtube'
                    ? 'Kredensial YouTube Data API v3'
                    : `Kredensial API ${activeModalProvider.toUpperCase()}`}
              </h2>
              <button
                type="button"
                onClick={() => setActiveModalProvider(null)}
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] shrink-0"
                aria-label="Tutup jendela kredensial"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {activeModalProvider === 'rapidapi'
                  ? 'Satu kunci RapidAPI mengaktifkan penarikan data X dan TikTok. Untuk Threads, Facebook, dan Instagram, gunakan TRINETRA_API_KEY di server untuk Muse Push.'
                  : 'Kredensial disimpan terenkripsi di server dan tidak pernah diekspos ke browser.'}
              </p>

              <div>
                <label
                  htmlFor="connector-api-key-input"
                  className="block text-[var(--text-primary)] font-semibold mb-1.5"
                >
                  {activeModalProvider === 'youtube'
                    ? 'Google API Key (YouTube Data API v3) *'
                    : 'RapidAPI Key (X-RapidAPI-Key) *'}
                </label>
                <input
                  id="connector-api-key-input"
                  type="password"
                  placeholder={activeModalProvider === 'youtube' ? 'AIzaSy...' : 'Masukkan kunci RapidAPI'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="input-field w-full min-h-11 px-3.5 py-2.5 text-base sm:text-xs font-mono-code"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-subtle)] text-xs">
              <button
                type="button"
                onClick={() => setActiveModalProvider(null)}
                className="btn-ghost-surface min-h-11 px-4 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!apiKeyInput.trim() || saveCredentialsMutation.isPending}
                onClick={() =>
                  saveCredentialsMutation.mutate({
                    provider: activeModalProvider,
                    apiKey: apiKeyInput,
                  })
                }
                className="btn-contrast min-h-11 px-5 disabled:opacity-50"
              >
                {saveCredentialsMutation.isPending ? 'Menyimpan...' : 'Simpan Kredensial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg-backdrop)] backdrop-blur-xs p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Live Preview Data Sumber"
            className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-t-3xl sm:rounded-3xl border border-[var(--border-medium)] bg-[var(--bg-surface)] p-5 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-4 shadow-[var(--shadow-elevated)] overflow-hidden"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[var(--border-subtle)] pb-4 shrink-0">
              <div className="min-w-0 space-y-1">
                <h2 className="font-editorial text-lg font-medium text-[var(--text-primary)] flex items-center flex-wrap gap-2">
                  <span>Live Preview</span>
                  <PlatformBadge provider={previewData.provider} size="sm" />
                </h2>
                <p className="text-xs text-[var(--text-muted)] font-mono-code font-tabular">
                  Latensi: {previewData.latency_ms}ms | Total: {previewData.count} | Terverifikasi:{' '}
                  {previewData.verified_count ?? 0}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] shrink-0"
                aria-label="Tutup jendela preview"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {previewData.status_message && (
              <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-secondary)] shrink-0">
                {previewData.status_message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <input
                type="text"
                aria-label="Kata kunci uji coba live preview"
                value={previewQuery}
                onChange={(e) => setPreviewQuery(e.target.value)}
                placeholder="Ketik topik uji coba..."
                className="input-field flex-1 min-h-11 px-3.5 py-2 text-base sm:text-xs"
              />
              <button
                type="button"
                onClick={() => void handleLivePreview(previewData.provider, previewQuery)}
                disabled={isPreviewLoading}
                className="btn-gold min-h-11 px-4 text-xs disabled:opacity-50 shrink-0"
              >
                {isPreviewLoading ? 'Mengambil...' : 'Cari Ulang'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-y-contain space-y-3 pr-1">
              {previewData.items.length === 0 ? (
                <div className="surface-inset py-12 px-4 text-center text-xs text-[var(--text-muted)] space-y-1.5">
                  <p className="font-semibold text-[var(--text-primary)]">
                    Tidak ada postingan terverifikasi ditemukan
                  </p>
                  <p>Coba kata kunci lebih spesifik atau pasang kunci API resmi.</p>
                </div>
              ) : (
                previewData.items.map((item, idx) => (
                  <div key={item.id || idx} className="pill-row p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold text-[var(--accent-gold-text)]">{item.author_name}</span>
                        {item.author_handle &&
                          !item.author_name.toLowerCase().includes(item.author_handle.toLowerCase()) && (
                            <span className="text-[11px] text-[var(--text-muted)] font-mono-code">
                              {item.author_handle}
                            </span>
                          )}
                        <span className="text-[11px] text-[var(--text-muted)] font-mono-code font-tabular">
                          {new Date(item.published_at).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <LinkVerificationBadge
                        provider={item.provider || previewData.provider}
                        sourceUrl={item.source_url}
                        linkStatus={item.link_status}
                        fallbackQuery={previewData.query}
                        showCopyButton
                        showActionLink
                      />
                    </div>

                    <p className="text-xs sm:text-[13px] text-[var(--text-primary)] leading-relaxed">{item.text}</p>

                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                      <SocialEngagementBar
                        metrics={item.metrics}
                        metricsAvailable={item.metrics_available}
                        showUnavailableHint
                      />
                      {item.source && (
                        <span className="text-[11px] text-[var(--text-muted)] font-mono-code">{item.source}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between shrink-0 text-xs">
              <span className="text-[var(--text-muted)] font-mono-code">
                Mesin: {previewData.engine}
              </span>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="btn-ghost-surface min-h-10 px-4 font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
