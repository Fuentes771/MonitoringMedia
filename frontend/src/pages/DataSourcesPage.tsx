import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ConnectorStatus, LivePreviewResponse } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Radio,
  Rss,
  Video,
  Globe,
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
import { PlatformBadge, SocialEngagementBar } from '@/components/common/PlatformBadge';
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

  // Escape closes modals cleanly (Antislop R-32)
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
    } catch (err: any) {
      setTestResult({
        provider,
        status: 'failed',
        message: err?.response?.data?.message || 'Gagal melakukan live preview penarikan data.',
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Fetch Connectors
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

  // Save Credentials Mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const res = await api.post(`/connectors/${provider}/credentials`, {
        workspace_id: workspaceId,
        api_key: apiKey,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
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
          desc: 'Pengumpulan otomatis multi-query dari portal berita terverifikasi (Google News ID, Antara News, Detik, Tempo, Kompas). Berjalan tanpa batasan kuota API.',
          icon: <Rss className="w-5 h-5 text-amber-400" />,
          sources: ['Google News Indonesia', 'Kompas.com', 'Detik.com', 'Tempo.co', 'Antara News'],
        };
      case 'youtube':
        return {
          title: 'YouTube Data API v3 & Public Stream',
          desc: 'Pencarian video publik, metadata channel, dan komentar netizen. Menggunakan YouTube Data API v3 jika kunci dipasang, atau ekstraksi publik otomatis tanpa biaya.',
          icon: <Video className="w-5 h-5 text-rose-500" />,
          sources: ['YouTube Search Endpoint', 'Video Metadata (API / Publik)', 'Comments Public Stream'],
        };
      case 'x':
      case 'twitter':
        return {
          title: 'Twitter / X (RapidAPI Hub)',
          desc: 'Pengumpulan percakapan publik, wacana opini politik, tweet breaking news, dan analisis top replies/komentar netizen.',
          icon: (
            <svg className="w-5 h-5 text-zinc-100" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          ),
          sources: ['X Search Stream', 'Top Replies / Netizen Comments', 'Trending Hashtags'],
        };
      case 'tiktok':
        return {
          title: 'TikTok Video & Comment Stream',
          desc: 'Pemantauan video tren viral publik Indonesia beserta analisis polaritas sentimen komentar netizen teratas.',
          icon: (
            <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
          ),
          sources: ['TikTok Feed Search', 'Top Netizen Comments', 'Audio & Video Metrics'],
        };
      case 'threads':
        return {
          title: 'Threads Publik (via Muse)',
          desc: 'Pencarian percakapan publik per topik di Threads melalui konektor resmi Muse CLI dan didorong ke endpoint ingest TRINETRA.',
          icon: (
            <svg className="w-5 h-5 text-zinc-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12a7 7 0 1 0-3.2 5.9" />
              <path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-4.1 7.5" />
              <circle cx="12" cy="12" r="3.5" />
            </svg>
          ),
          sources: ['Muse threads-cli search', 'Postingan & Balasan Publik', 'POST /api/v1/ingest/mentions'],
        };
      case 'instagram':
        return {
          title: 'Instagram Publik (via Muse)',
          desc: 'Pengumpulan postingan, Reels, dan komentar publik Instagram melalui konektor resmi Muse dan watchlist akun terverifikasi.',
          icon: (
            <svg className="w-5 h-5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
              <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
            </svg>
          ),
          sources: ['Muse instagram-cli & social.search', 'Public Posts & Reels', 'POST /api/v1/ingest/mentions'],
        };
      case 'facebook':
        return {
          title: 'Facebook Publik (via Muse)',
          desc: 'Pemantauan postingan, komentar, dan reaksi publik Facebook melalui konektor resmi Muse tanpa scraping langsung dari server TRINETRA.',
          icon: (
            <svg className="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.82 0-1.666.28-1.666 1.369v2.611h3.708l-.571 3.667h-3.137v7.98H9.101z" />
            </svg>
          ),
          sources: ['Muse facebook-cli & social.search', 'Postingan & Komentar Publik', 'POST /api/v1/ingest/mentions'],
        };
      case 'reddit':
        return {
          title: 'Reddit Developer Platform',
          desc: 'Pengumpulan diskusi forum dan subreddit publik sesuai ketentuan Reddit Developer Terms.',
          icon: <Globe className="w-5 h-5 text-zinc-400" />,
          sources: ['r/indonesia', 'Subreddit Publik Terverifikasi'],
        };
      default:
        return {
          title: provider.toUpperCase(),
          desc: 'Sumber data digital pihak ketiga.',
          icon: <Globe className="w-5 h-5 text-zinc-400" />,
          sources: ['External Source Feed'],
        };
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return 'Belum disinkron';
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB';
  };

  return (
    <div className="space-y-4 sm:space-y-6 font-sans-ui">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3.5 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Radio className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-editorial text-xl sm:text-2xl font-medium text-white tracking-tight text-balance">
              Konektor Sumber Data &amp; Pipeline Ingesti
            </h1>
            <p className="text-xs text-zinc-400 font-sans-ui mt-0.5 text-pretty">
              Arsitektur pipeline ingesti data media, monitoring latensi koneksi, dan autentikasi resmi
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveModalProvider('rapidapi')}
            className="flex-1 sm:flex-none min-h-11 sm:min-h-10 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-semibold font-mono-code transition-all shadow-xs cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Setup Unified RapidAPI Hub</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-mono-code bg-white/[0.03] px-3 py-2 rounded-xl border border-white/[0.08]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>Pipeline: <strong className="text-white">OPERASIONAL</strong></span>
          </div>
        </div>
      </div>

      {/* Visual Data Ingestion Pipeline Flow Architecture */}
      <div className="bento-card p-4 sm:p-6 bg-gradient-to-br from-[#0e1117] via-[#0d1017] to-[#131724] relative overflow-hidden">
        {/* Ambient Wallpaper Artwork */}
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 bottom-0 w-2/3 bg-cover bg-center pointer-events-none opacity-25"
          style={{ backgroundImage: `url('/brand/ambient-backdrop.webp')` }}
        />
        {/* Heraldic Crest Watermark in background */}
        <img
          src="/brand/crest-watermark.webp"
          alt=""
          aria-hidden="true"
          width={256}
          height={256}
          loading="lazy"
          decoding="async"
          className="absolute -right-10 -bottom-10 w-52 h-52 sm:w-64 sm:h-64 object-cover opacity-[0.06] rounded-full pointer-events-none select-none"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-white/[0.08] relative z-10">
          <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Arsitektur Aliran Pipeline Ingesti Real-Time</span>
          </span>
          <span className="text-[11px] text-zinc-400 font-mono-code">Latency SLA: &lt; 2s</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {/* Node 1: Multi-Source Crawlers */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-code">
              <span className="text-amber-400 font-bold">TAHAP 1</span>
              <span className="text-zinc-500">Ingesti</span>
            </div>
            <h4 className="font-semibold text-white text-sm font-sans-ui flex items-center gap-2">
              <Rss className="w-4 h-4 text-amber-400" />
              <span>Multi-Source Collectors</span>
            </h4>
            <p className="text-xs text-zinc-400 font-sans-ui">
              Query multi-keyword berkala ke Google News ID, Antara, Detik, Tempo. Deduplikasi otomatis berbasis hash URL.
            </p>
          </div>

          {/* Node 2: NLP Classifier */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-code">
              <span className="text-amber-400 font-bold">TAHAP 2</span>
              <span className="text-zinc-500">Inferensi</span>
            </div>
            <h4 className="font-semibold text-white text-sm font-sans-ui flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <span>IndoBERT Sentiment &amp; Slang</span>
            </h4>
            <p className="text-xs text-zinc-400 font-sans-ui">
              FastAPI NLP Service mengekstrak sentimen positif, netral, negatif, confidence score, dan entitas dominan.
            </p>
          </div>

          {/* Node 3: PostgreSQL Data Lake */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-code">
              <span className="text-emerald-400 font-bold">TAHAP 3</span>
              <span className="text-zinc-500">Penyimpanan</span>
            </div>
            <h4 className="font-semibold text-white text-sm font-sans-ui flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>PostgreSQL &amp; Trend Snapshots</span>
            </h4>
            <p className="text-xs text-zinc-400 font-sans-ui">
              Penyimpanan terindeks dengan komputasi akselerasi momentum tren (0-100) dan pemicu ambang batas krisis.
            </p>
          </div>
        </div>
      </div>

      {testResult && (
        <div className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-xs ${
          testResult.status === 'success' || testResult.status === 'connected'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : testResult.status === 'needs_config'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2.5 font-mono-code">
            {testResult.status === 'success' || testResult.status === 'connected' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>
              <strong className="capitalize">{testResult.provider}:</strong> {testResult.message}
              {testResult.latencyMs && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-white/[0.1] text-white">
                  Latensi: {testResult.latencyMs}ms
                </span>
              )}
            </span>
          </div>
          <button onClick={() => setTestResult(null)} className="text-zinc-400 hover:text-white cursor-pointer" aria-label="Tutup pesan">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Connectors List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : (
          connectors?.map((conn: any) => {
            const meta = getProviderMeta(conn.provider);
            const isConnected = conn.status === 'connected';
            const isNeedsConfig = conn.status === 'needs_config';
            const isTesting = testingProvider === conn.provider;

            return (
              <div
                key={conn.id}
                className="bento-card p-4 sm:p-6 bg-[#0e1117] space-y-4 transition-all"
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 sm:gap-3.5 min-w-0">
                    <div className="p-2.5 sm:p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] shrink-0">
                      {meta.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-editorial text-lg sm:text-xl font-medium text-white tracking-tight">
                          {meta.title}
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono-code font-bold ${
                          isConnected
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isNeedsConfig
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          {isConnected ? 'TERHUBUNG' : isNeedsConfig ? 'PERLU KONFIGURASI' : 'NONAKTIF'}
                        </span>
                        {conn.engine_mode === 'muse_push' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-sky-500/10 text-sky-300 border border-sky-500/30">
                            MUSE PUSH
                          </span>
                        )}
                        {conn.has_local_engine && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            EKSTRAKSI PUBLIK GRATIS
                          </span>
                        )}
                        {conn.has_rapidapi && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-white/[0.06] text-zinc-300 border border-white/[0.15]">
                            RAPIDAPI AKTIF
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 max-w-xl leading-relaxed font-sans-ui text-pretty">
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0 flex-wrap">
                    {['x', 'tiktok', 'youtube'].includes(conn.provider) && (
                      <button
                        type="button"
                        onClick={() => handleLivePreview(conn.provider)}
                        disabled={isPreviewLoading}
                        className="min-h-11 sm:min-h-9 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-xs text-amber-300 hover:text-amber-200 transition-all font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <Eye className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                        <span>{isPreviewLoading && activePreviewProvider === conn.provider ? 'Mengambil Data...' : 'Live Preview Data Riil'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => testConnection(conn.provider)}
                      disabled={isTesting}
                      className="min-h-11 sm:min-h-9 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs text-zinc-200 hover:text-white transition-all font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Activity className={`w-3.5 h-3.5 shrink-0 ${isTesting ? 'animate-spin text-amber-400' : 'text-amber-400'}`} aria-hidden="true" />
                      <span>{isTesting ? 'Menguji...' : 'Uji Koneksi'}</span>
                    </button>

                    {conn.provider === 'youtube' && (
                      <button
                        type="button"
                        onClick={() => setActiveModalProvider(conn.provider)}
                        className="min-h-11 sm:min-h-9 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{conn.has_credentials ? 'Ubah Kunci API' : 'Pasang Kunci API'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-sources Monitored */}
                <div className="pt-3 border-t border-white/[0.06]">
                  <span className="text-[10px] font-mono-code font-bold uppercase tracking-wider text-zinc-400 block mb-2">
                    Portal &amp; Saluran Terverifikasi yang Dipantau:
                  </span>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {meta.sources.map((s, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.02] border border-white/[0.06] text-[11px] sm:text-xs font-mono-code text-zinc-300"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Capability Matrix & Provenance Checklist */}
                <div className="pt-3 border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs font-mono-code">
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] text-zinc-400 block mb-1">Pencarian Kata Kunci</span>
                    <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Didukung
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] text-zinc-400 block mb-1">Akses Konten Publik</span>
                    <span className="font-semibold text-white flex items-center gap-1.5 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Feed Resmi &amp; Terbuka
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] text-zinc-400 block mb-1">Metode Pengumpulan</span>
                    <span className="font-semibold text-white text-xs">
                      {conn.provider === 'rss'
                        ? 'RSS/Atom Feeds'
                        : conn.engine_mode === 'muse_push'
                        ? 'Muse Official CLI Push'
                        : 'API Resmi + Verifikasi Publik'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                    <span className="text-[10px] text-zinc-400 block mb-1">Sinkronisasi Terakhir</span>
                    <span className="font-semibold text-zinc-300 text-xs">
                      {formatTimestamp(conn.last_successful_sync_at)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Configure Credentials Modal */}
      {activeModalProvider && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Konfigurasi Kredensial API"
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-2xl sm:rounded-2xl border border-white/[0.12] bg-[#0c0e14] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                </div>
                <h2 className="font-editorial text-base sm:text-lg font-medium text-white truncate">
                  {activeModalProvider === 'rapidapi'
                    ? 'Unified RapidAPI Hub (X, TikTok)'
                    : activeModalProvider === 'youtube'
                    ? 'Kredensial API YouTube Data v3'
                    : `Kredensial API ${activeModalProvider.toUpperCase()}`}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalProvider(null)}
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                aria-label="Tutup jendela kredensial"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-zinc-400 leading-relaxed text-xs font-sans-ui">
                {activeModalProvider === 'rapidapi'
                  ? 'Satu kunci RapidAPI ini akan otomatis mengotentikasi dan mengaktifkan ingestion untuk Twitter / X dan TikTok. Untuk Threads, Facebook, dan Instagram, atur TRINETRA_API_KEY di environment server untuk Muse Push.'
                  : 'Kredensial disimpan terenkripsi di database server dan tidak pernah diekspos ke publik atau browser client.'}
              </p>

              <div>
                <label htmlFor="connector-api-key-input" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  {activeModalProvider === 'youtube'
                    ? 'Google API Key (YouTube Data API v3) *'
                    : 'RapidAPI Key (X-RapidAPI-Key) *'}
                </label>
                <input
                  id="connector-api-key-input"
                  type="password"
                  placeholder={
                    activeModalProvider === 'youtube'
                      ? 'AIzaSy...'
                      : 'Kunci RapidAPI Anda (misal: 5871bb55...)'
                  }
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full min-h-11 bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors shadow-xs font-mono-code"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setActiveModalProvider(null)}
                className="min-h-11 px-3.5 py-2 rounded-xl border border-white/[0.12] text-zinc-200 hover:bg-white/[0.06] transition-colors font-medium cursor-pointer"
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
                className="min-h-11 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                {saveCredentialsMutation.isPending ? 'Menyimpan...' : 'Simpan Kredensial'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Preview Scraper Data Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Live Preview Data Sumber"
            className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-white/[0.12] bg-[#0c0e14] p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] space-y-3.5 sm:space-y-4 shadow-2xl overflow-hidden"
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-3.5 shrink-0">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-editorial text-base sm:text-lg font-medium text-white flex items-center flex-wrap gap-1.5 sm:gap-2">
                    <span>Live Preview:</span>
                    <PlatformBadge provider={previewData.provider} size="sm" />
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono-code font-bold border ${
                        previewData.engine_status === 'ok'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {previewData.engine_status === 'ok'
                        ? 'PENARIKAN REAL-TIME'
                        : previewData.engine_status === 'rate_limited'
                        ? 'LIMIT PENCARIAN'
                        : previewData.engine_status === 'fallback_only'
                        ? 'PERLU VERIFIKASI'
                        : 'VERIFIKASI TERBATAS'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-zinc-400 font-mono-code mt-0.5 font-tabular">
                    Latensi: {previewData.latency_ms}ms | Total: {previewData.count} | Terverifikasi: {previewData.verified_count ?? 0}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                aria-label="Tutup jendela preview"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {previewData.status_message && (
              <div
                className={`p-3 rounded-xl border text-xs font-sans-ui shrink-0 ${
                  previewData.engine_status && previewData.engine_status !== 'ok'
                    ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                    : 'bg-white/[0.03] border-white/[0.08] text-zinc-300'
                }`}
              >
                {previewData.status_message}
              </div>
            )}

            {/* Keyword tester input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <input
                type="text"
                aria-label="Kata kunci uji coba live preview"
                value={previewQuery}
                onChange={(e) => setPreviewQuery(e.target.value)}
                placeholder="Ketik topik uji coba..."
                className="flex-1 min-h-11 bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors shadow-xs font-mono-code"
              />
              <button
                type="button"
                onClick={() => handleLivePreview(previewData.provider, previewQuery)}
                disabled={isPreviewLoading}
                className="min-h-11 px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
              >
                {isPreviewLoading ? 'Mengambil...' : 'Cari Ulang'}
              </button>
            </div>

            {/* Scraped Items List */}
            <div className="flex-1 overflow-y-auto overscroll-y-contain space-y-3 pr-1">
              {previewData.items.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 text-xs font-mono-code space-y-2">
                  <div>Tidak ada postingan terverifikasi ditemukan untuk kata kunci ini secara lokal.</div>
                  <div className="text-zinc-500 text-[11px]">
                    Sistem tidak lagi membuat tautan palsu. Coba kata kunci lebih spesifik atau pasang kunci API resmi/RapidAPI.
                  </div>
                </div>
              ) : (
                previewData.items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold text-amber-300 font-mono-code">
                          {item.author_name}
                        </span>
                        {item.author_handle &&
                          !item.author_name.toLowerCase().includes(item.author_handle.toLowerCase()) && (
                            <span className="text-[11px] text-zinc-400 font-mono-code">
                              {item.author_handle}
                            </span>
                          )}
                        <span className="text-[10px] text-zinc-500 font-mono-code font-tabular">
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

                    <p className="text-xs text-zinc-200 leading-relaxed font-sans-ui">{item.text}</p>

                    <div className="pt-1.5 border-t border-white/[0.04] flex items-center justify-between gap-2">
                      <SocialEngagementBar
                        metrics={item.metrics}
                        metricsAvailable={item.metrics_available}
                        showUnavailableHint
                      />
                      {item.source && (
                        <span className="text-[10px] text-zinc-500 font-mono-code">{item.source}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between shrink-0 text-xs">
              <span className="text-zinc-500 text-[11px] font-mono-code">
                Mesin: {previewData.engine} | Tautan melewati validasi kanonik server.
              </span>
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-semibold transition-colors cursor-pointer"
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
