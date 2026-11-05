import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Rss, Video, Globe, CheckCircle2, AlertCircle, KeyRound, Activity, X } from 'lucide-react';

export function DataSourcesPage() {
  const queryClient = useQueryClient();
  const [activeModalProvider, setActiveModalProvider] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testResult, setTestResult] = useState<{ provider: string; message: string; status: string } | null>(null);

  const { data: connectors, isLoading } = useQuery({
    queryKey: ['connectors-list'],
    queryFn: async () => {
      const res = await api.get('/connectors', { params: { workspace_id: 1 } });
      return res.data.data;
    },
  });

  const saveCredentialsMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: { provider: string; apiKey: string }) => {
      const res = await api.post(`/connectors/${provider}/connect`, {
        api_key: apiKey,
        workspace_id: 1,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connectors-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setActiveModalProvider(null);
      setApiKeyInput('');
      setTestResult({
        provider: 'youtube',
        status: 'success',
        message: 'Kredensial berhasil disimpan.',
      });
      setTimeout(() => setTestResult(null), 5000);
    },
  });

  const testConnection = async (provider: string) => {
    try {
      const res = await api.post(`/connectors/${provider}/test`, { workspace_id: 1 });
      setTestResult({
        provider,
        status: res.data.status,
        message: res.data.message,
      });
    } catch {
      setTestResult({
        provider,
        status: 'failed',
        message: 'Koneksi gagal atau endpoint tidak merespons.',
      });
    }
    setTimeout(() => setTestResult(null), 5000);
  };

  const getProviderMeta = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'rss':
        return {
          title: 'Media Berita (RSS & Atom Feeds)',
          desc: 'Pengumpulan otomatis dari portal berita terverifikasi (Google News ID, Antara, Detik, Tempo). Bebas kuota API.',
          icon: <Rss className="w-5 h-5 text-amber-400" />,
        };
      case 'youtube':
        return {
          title: 'YouTube Data API v3',
          desc: 'Pencarian video publik, deskripsi, dan statistik engagement resmi melalui Google Developers API.',
          icon: <Video className="w-5 h-5 text-rose-500" />,
        };
      case 'reddit':
        return {
          title: 'Reddit Data API',
          desc: 'Pengumpulan diskusi forum dan subreddit publik sesuai Reddit Developer Platform Terms.',
          icon: <Globe className="w-5 h-5 text-indigo-400" />,
        };
      default:
        return {
          title: provider.toUpperCase(),
          desc: 'Sumber data digital pihak ketiga.',
          icon: <Globe className="w-5 h-5 text-slate-400" />,
        };
    }
  };

  const formatTimestamp = (iso?: string | null) => {
    if (!iso) return 'Belum pernah sinkron';
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight mb-1">
          Konektor Sumber Data (Data Ingestion Connectors)
        </h1>
        <p className="text-xs text-slate-400">
          Status koneksi, transparansi kemampuan integrasi, dan pengelolaan kredensial API resmi per PRD Bab 4
        </p>
      </div>

      {testResult && (
        <div className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
          testResult.status === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : testResult.status === 'needs_config'
            ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            {testResult.status === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
            <span><strong>[{testResult.provider.toUpperCase()}]:</strong> {testResult.message}</span>
          </div>
          <button onClick={() => setTestResult(null)} className="opacity-80 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Connectors Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : (
          connectors?.map((conn: any) => {
            const meta = getProviderMeta(conn.provider);
            const isConnected = conn.status === 'connected';
            const isNeedsConfig = conn.status === 'needs_config';

            return (
              <div
                key={conn.id}
                className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-white tracking-tight">
                          {meta.title}
                        </h2>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          isConnected
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : isNeedsConfig
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {conn.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 max-w-xl">
                        {meta.desc}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => testConnection(conn.provider)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-850 hover:bg-slate-800 text-xs text-slate-300 font-medium transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Uji Koneksi</span>
                    </button>

                    {conn.provider === 'youtube' && (
                      <button
                        onClick={() => setActiveModalProvider(conn.provider)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{conn.has_credentials ? 'Ubah API Key' : 'Pasang API Key'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Capability Matrix & Provenance Checklist */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Pencarian Kata Kunci</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Didukung
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Konten Publik</span>
                    <span className="font-semibold text-slate-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Resmi & Terbuka
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Metode Pengumpulan</span>
                    <span className="font-semibold text-slate-200">
                      {conn.provider === 'rss' ? 'RSS/Atom Feeds' : 'REST API v3'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-850">
                    <span className="text-[10px] text-slate-400 block mb-0.5">Sinkron Terakhir</span>
                    <span className="font-semibold text-slate-200 font-mono text-[11px]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                <span>Konfigurasi API Key YouTube Data API v3</span>
              </h2>
              <button
                onClick={() => setActiveModalProvider(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400 leading-relaxed">
                Kredensial disimpan terenkripsi di database server dan tidak pernah diekspos ke publik atau browser client.
              </p>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Google API Key (YouTube Data API v3) *
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveModalProvider(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                disabled={!apiKeyInput.trim() || saveCredentialsMutation.isPending}
                onClick={() => saveCredentialsMutation.mutate({ provider: 'youtube', apiKey: apiKeyInput })}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {saveCredentialsMutation.isPending ? 'Menyimpan...' : 'Simpan Kredensial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
