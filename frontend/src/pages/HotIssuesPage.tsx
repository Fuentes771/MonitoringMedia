import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, HotIssuesRadarData, HotIssueItem } from '@/lib/api';
import {
  Flame,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Clock,
  Plus,
  ExternalLink,
  Rss,
  Video,
  Globe,
  X,
  CheckCircle2,
  Activity,
  MessageSquareText,
  Archive,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export function HotIssuesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'elevated' | 'critical'>('elevated');
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Fetch Hot Issues
  const { data: radarResponse, isLoading } = useQuery({
    queryKey: ['hot-issues-radar'],
    queryFn: async () => {
      const res = await api.get<{ data: HotIssuesRadarData }>('/hot-issues', {
        params: { workspace_id: 1 },
      });
      return res.data.data;
    },
    refetchInterval: 15000, // Poll every 15s for breaking surges
  });

  // Automated Discovery Scan Mutation
  const scanHotIssuesMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/hot-issues/scan', { workspace_id: 1 });
      return res.data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['hot-issues-radar'] });
      setScanMessage(data.message || 'Pemindaian berita Google News selesai.');
      setTimeout(() => setScanMessage(null), 6000);
    },
    onError: () => {
      setScanMessage('Gagal memindai berita. Silakan coba kembali.');
      setTimeout(() => setScanMessage(null), 6000);
    },
  });

  // Archive Hot Issue Mutation
  const archiveHotIssueMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/hot-issues/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hot-issues-radar'] });
    },
  });

  // Create Hot Issue Mutation
  const createHotIssueMutation = useMutation({
    mutationFn: async () => {
      const kwList = keywords
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

      const res = await api.post('/hot-issues', {
        workspace_id: 1,
        name,
        description,
        urgency_level: urgencyLevel,
        keywords: kwList.length > 0 ? kwList : [name],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hot-issues-radar'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setKeywords('');
    },
  });

  const getPlatformIcon = (prov: string) => {
    switch (prov.toLowerCase()) {
      case 'rss':
        return <Rss className="w-3.5 h-3.5 text-amber-400" />;
      case 'youtube':
        return <Video className="w-3.5 h-3.5 text-rose-500" />;
      case 'x':
      case 'twitter':
        return (
          <svg className="w-3.5 h-3.5 text-zinc-100" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'tiktok':
        return (
          <svg className="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-3.5 h-3.5 text-pink-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-3.5 h-3.5 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.82 0-1.666.28-1.666 1.369v2.611h3.708l-.571 3.667h-3.137v7.98H9.101z" />
          </svg>
        );
      default:
        return <Globe className="w-3.5 h-3.5 text-zinc-400" />;
    }
  };

  const hotIssues = radarResponse?.hot_issues || [];
  const isSurging = radarResponse?.system_state === 'surging_detected';

  return (
    <div className="space-y-6 font-sans-ui">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-xs">
            <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-editorial text-2xl font-medium text-white tracking-tight">
                Radar Isu Hangat (Breaking &amp; Viral Surge)
              </h1>
              {isSurging && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                  SURGE DETECTED
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-sans-ui">
              Deteksi anomali lonjakan percakapan publik di luar 17 program prioritas (Jendela {radarResponse?.window_label || '33 Jam Terkini'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => scanHotIssuesMutation.mutate()}
            disabled={scanHotIssuesMutation.isPending}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${scanHotIssuesMutation.isPending ? 'animate-spin' : ''}`} />
            <span>{scanHotIssuesMutation.isPending ? 'Memindai Google News...' : 'Pindai Isu Terkini'}</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Pantau Manual</span>
          </button>
        </div>
      </div>

      {/* Toast Notification after Scan */}
      {scanMessage && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium font-sans-ui">{scanMessage}</span>
          </div>
          <button
            onClick={() => setScanMessage(null)}
            className="text-zinc-400 hover:text-white text-xs font-mono-code cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* System Status Banner */}
      {isSurging ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 via-amber-950/30 to-black/40 border border-rose-500/40 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-rose-300 font-mono-code uppercase block text-[11px]">
                Anomali Ruang Publik Terdeteksi ({radarResponse?.surging_count} Isu Melonjak)
              </span>
              <p className="text-zinc-300 text-xs">
                Percakapan netizen terdeteksi mengalami akselerasi ekstrem di atas ambang batas normal pada jendela pemantauan 33 jam.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono-code text-zinc-400 hidden sm:block">
            {radarResponse?.window_label}
          </span>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-emerald-300 font-mono-code uppercase block text-[11px]">
                Kondisi Percakapan Publik Normal &amp; Kondusif
              </span>
              <p className="text-zinc-300 text-xs">
                Tidak ada anomali lonjakan isu atau krisis viral baru yang meledak di luar ambang batas saat ini.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono-code text-zinc-400 hidden sm:block">
            Status: Steady State
          </span>
        </div>
      )}

      {/* Hot Issues List */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-72 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : hotIssues.length === 0 ? (
          <div className="bento-card p-12 text-center space-y-4 bg-[#0e1117]">
            <Flame className="w-8 h-8 text-zinc-600 mx-auto" />
            <h3 className="font-editorial text-lg text-white font-medium">Belum Ada Isu Hangat Aktif</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Sistem mendeteksi lonjakan percakapan publik secara otomatis dari Google News. Anda dapat memicu pemindaian berita terkini sekarang atau mendaftarkan topik secara manual.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <button
                onClick={() => scanHotIssuesMutation.mutate()}
                disabled={scanHotIssuesMutation.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${scanHotIssuesMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{scanHotIssuesMutation.isPending ? 'Sedang Memindai Google News...' : 'Pindai Berita Terhangat Sekarang'}</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-xs border border-white/[0.1] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Manual</span>
              </button>
            </div>
          </div>
        ) : (
          hotIssues.map((issue: HotIssueItem) => {
            const isCritical = issue.urgency_level === 'critical';
            return (
              <div
                key={issue.id}
                className="bento-card p-6 bg-[#0e1117] space-y-5 border border-white/[0.08] hover:border-white/[0.16] transition-all"
              >
                {/* Header ribbon */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono-code flex items-center gap-1.5 ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{isCritical ? 'URGENSI KRITIS' : 'URGENSI TINGGI'}</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono-code font-bold flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{issue.surge_multiplier}x Lonjakan Tren</span>
                    </span>

                    <span className="text-xs text-zinc-400 font-mono-code flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Jendela 33 Jam</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono-code text-zinc-400">
                      Total Sebutan: <strong className="text-white">{issue.total_mentions_33h}</strong>
                    </span>
                    <button
                      onClick={() => {
                        if (confirm(`Arsipkan isu '${issue.title}' dari Radar Pantauan?`)) {
                          archiveHotIssueMutation.mutate(issue.id);
                        }
                      }}
                      title="Arsipkan dari Radar"
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono-code text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.06] hover:border-rose-500/20 transition-all cursor-pointer"
                    >
                      <Archive className="w-3 h-3" />
                      <span>Arsipkan</span>
                    </button>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h2 className="font-editorial text-xl sm:text-2xl font-medium text-white leading-snug">
                    {issue.title}
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans-ui mt-1 leading-relaxed">
                    {issue.description}
                  </p>
                </div>

                {/* KPI Triad + Sparkline Curve */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Left: Sentiment Share Bar */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                    <span className="text-[11px] font-mono-code font-bold uppercase text-zinc-400 block">
                      Polaritas Sentimen Publik
                    </span>
                    <div className="flex items-center justify-between text-xs font-mono-code">
                      <span className="text-emerald-400 font-bold">Positif: {issue.sentiment.pos_percent}%</span>
                      <span className="text-zinc-400 font-bold">Netral: {issue.sentiment.neu_percent}%</span>
                      <span className="text-rose-400 font-bold">Kritis: {issue.sentiment.neg_percent}%</span>
                    </div>
                    {/* Visual Tri-color Bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-white/[0.05]">
                      <div style={{ width: `${issue.sentiment.pos_percent}%` }} className="bg-emerald-500 h-full" />
                      <div style={{ width: `${issue.sentiment.neu_percent}%` }} className="bg-zinc-400 h-full" />
                      <div style={{ width: `${issue.sentiment.neg_percent}%` }} className="bg-rose-500 h-full" />
                    </div>
                    <p className="text-[11px] text-zinc-500 font-sans-ui leading-tight">
                      Sentimen kritis didorong oleh tuntutan transparansi dan kekhawatiran dampak kebijakan.
                    </p>
                  </div>

                  {/* Middle: 33-Hour Activity Curve */}
                  <div className="lg:col-span-2 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono-code">
                      <span className="font-bold uppercase text-zinc-400 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-400" />
                        <span>Kurva Akselerasi Sebutan (Per 3 Jam)</span>
                      </span>
                      <span className="text-amber-400 font-bold">Puncak Lonjakan Terdeteksi</span>
                    </div>

                    <div className="h-24 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={issue.hourly_velocity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`colorSurge-${issue.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isCritical ? '#f43f5e' : '#f59e0b'} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={isCritical ? '#f43f5e' : '#f59e0b'} stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time_label" hide />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0c0e14',
                              borderColor: 'rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              fontSize: '11px',
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke={isCritical ? '#f43f5e' : '#f59e0b'}
                            strokeWidth={2}
                            fillOpacity={1}
                            fill={`url(#colorSurge-${issue.id})`}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* AI Threat & Resistance Synthesis */}
                {issue.ai_synthesis && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-amber-950/20 via-zinc-900/30 to-transparent border border-amber-500/25 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-mono-code font-bold text-amber-300 uppercase">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sintesis Intelijen AI: Pemetaan Risiko &amp; Resistensi Publik</span>
                    </div>
                    <p className="text-xs text-zinc-300 font-sans-ui leading-relaxed">
                      {issue.ai_synthesis}
                    </p>
                  </div>
                )}

                {/* Netizen Voices & Multi-Channel Evidence Matrix */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs font-mono-code">
                    <span className="font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                      <MessageSquareText className="w-3.5 h-3.5 text-amber-400" />
                      <span>Suara Netizen &amp; Bukti Sebutan Lintas Kanal (X, TikTok, Berita, IG, FB)</span>
                    </span>
                    <span className="text-zinc-500">Urut berdasarkan Resonansi / Likes</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {issue.netizen_quotes.map((q) => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            {getPlatformIcon(q.platform)}
                            <span className="font-semibold text-zinc-200 font-mono-code truncate max-w-[150px]">
                              {q.author}
                            </span>
                            {q.is_comment && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono-code bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                Komentar
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 font-mono-code text-[10px]">
                            {q.likes > 0 && (
                              <span className="text-zinc-400">❤️ {q.likes.toLocaleString('id-ID')}</span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                q.sentiment === 'positive'
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : q.sentiment === 'negative'
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                  : 'bg-zinc-500/15 text-zinc-300 border border-zinc-500/30'
                              }`}
                            >
                              {q.sentiment.toUpperCase()}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-white font-sans-ui leading-relaxed line-clamp-3">
                          &ldquo;{q.text}&rdquo;
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono-code pt-1 border-t border-white/[0.04]">
                          <span>{q.time_label}</span>
                          {q.source_url && (
                            <a
                              href={q.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-400 hover:text-amber-300 flex items-center gap-1"
                            >
                              <span>Tautan</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Tambah Pantauan Isu Hangat Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.12] bg-[#0c0e14] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <h2 className="font-editorial text-lg font-medium text-white">
                    Pantau Isu Hangat Baru
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    Daftarkan wacana viral atau krisis komunikasi yang sedang meledak
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans-ui">
              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-xs">
                  Judul Isu Hangat *
                </label>
                <input
                  type="text"
                  placeholder="misal: Dugaan Penyadapan Presiden Prabowo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-xs">
                  Deskripsi / Konteks Isu
                </label>
                <textarea
                  rows={2}
                  placeholder="Konteks mengapa isu ini sedang hangat diperbincangkan netizen..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-xs">
                  Kata Kunci Pemantauan (Pisahkan dengan koma) *
                </label>
                <input
                  type="text"
                  placeholder="misal: penyadapan prabowo, sadap istana, kebocoran data bin"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-3.5 py-2 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-500 transition-colors font-mono-code"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-semibold mb-1 text-xs">
                  Tingkat Urgensi
                </label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'critical'}
                      onChange={() => setUrgencyLevel('critical')}
                      className="text-rose-500 focus:ring-0"
                    />
                    <span className="text-rose-400 font-semibold">Kritis (Surge Tinggi)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'elevated'}
                      onChange={() => setUrgencyLevel('elevated')}
                      className="text-amber-500 focus:ring-0"
                    />
                    <span className="text-amber-400 font-semibold">Tinggi (Meningkat)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'normal'}
                      onChange={() => setUrgencyLevel('normal')}
                      className="accent-amber-400 text-amber-400 focus:ring-0"
                    />
                    <span className="text-amber-300 font-semibold">Normal</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-white/[0.08] text-zinc-300 hover:bg-white/[0.05] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!name.trim() || createHotIssueMutation.isPending}
                onClick={() => createHotIssueMutation.mutate()}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold disabled:opacity-50 transition-colors cursor-pointer"
              >
                {createHotIssueMutation.isPending ? 'Menyimpan...' : 'Mulai Pantau Isu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

