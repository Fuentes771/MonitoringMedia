import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, HotIssuesRadarData, HotIssueItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Flame,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  Clock,
  Plus,
  X,
  CheckCircle2,
  Activity,
  MessageSquareText,
  Archive,
  ArrowRight,
} from 'lucide-react';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { LinkVerificationBadge } from '@/components/common/LinkVerificationBadge';
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HotIssuesPageProps {
  onNavigateToMentions?: (topicId?: number) => void;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

export function HotIssuesPage({ onNavigateToMentions, onOpenAiWithQuery }: HotIssuesPageProps = {}) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<'normal' | 'elevated' | 'critical'>('elevated');
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Fetch Hot Issues
  const { data: radarResponse, isLoading } = useQuery({
    queryKey: ['hot-issues-radar', workspaceId],
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<{ data: HotIssuesRadarData }>('/hot-issues', {
        params: { workspace_id: workspaceId },
      });
      return res.data.data;
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  // Automated Discovery Scan Mutation
  const scanHotIssuesMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/hot-issues/scan', { workspace_id: workspaceId });
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
        workspace_id: workspaceId,
        name,
        description,
        urgency_level: urgencyLevel,
        keywords: kwList.length > 0 ? kwList : [name],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hot-issues-radar'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-data'] });
      queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setKeywords('');
    },
  });

  const hotIssues = radarResponse?.hot_issues || [];
  const isSurging = radarResponse?.system_state === 'surging_detected';

  return (
    <div className="space-y-4 sm:space-y-6 font-sans-ui">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3.5 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Flame className="w-4 h-4 text-amber-400" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-editorial text-xl sm:text-2xl font-medium text-white tracking-tight text-balance">
                Radar Isu Hangat (Breaking &amp; Viral Surge)
              </h1>
              {isSurging && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-rose-500/20 text-rose-300 border border-rose-500/35 shrink-0">
                  SURGE DETECTED
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 font-sans-ui mt-0.5 text-pretty">
              Deteksi anomali lonjakan percakapan publik di luar 17 program prioritas (Jendela {radarResponse?.window_label || '33 Jam Terkini'})
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => scanHotIssuesMutation.mutate()}
            disabled={scanHotIssuesMutation.isPending}
            className="flex-1 md:flex-none min-h-11 sm:min-h-10 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 shrink-0 ${scanHotIssuesMutation.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{scanHotIssuesMutation.isPending ? 'Memindai...' : 'Pindai Isu Terkini'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none min-h-11 sm:min-h-10 flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Pantau Manual</span>
          </button>
        </div>
      </div>

      {/* Zero-Touch Auto Discovery Banner */}
      {radarResponse?.auto_discovered && radarResponse?.auto_discovery_message && (
        <div className="p-3.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-200 text-xs flex items-center gap-2.5 shadow-xs">
          <Sparkles className="w-4 h-4 text-sky-300 shrink-0" aria-hidden="true" />
          <span className="font-medium font-sans-ui">
            Pemindaian Otomatis Google News: {radarResponse.auto_discovery_message}
          </span>
        </div>
      )}

      {/* Toast Notification after Scan */}
      {scanMessage && (
        <div className="p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between shadow-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="font-medium font-sans-ui">{scanMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setScanMessage(null)}
            aria-label="Tutup notifikasi pemindaian"
            className="text-zinc-300 hover:text-white text-xs font-mono-code cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 rounded p-0.5"
          >
            <X className="w-3.5 h-3.5" />
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
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => scanHotIssuesMutation.mutate()}
                disabled={scanHotIssuesMutation.isPending}
                className="min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 shrink-0 ${scanHotIssuesMutation.isPending ? 'animate-spin' : ''}`} aria-hidden="true" />
                <span>{scanHotIssuesMutation.isPending ? 'Sedang Memindai Google News...' : 'Pindai Berita Terhangat Sekarang'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="min-h-11 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-semibold text-xs border border-white/[0.1] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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
                className="bento-card p-4 sm:p-6 bg-[#0e1117] space-y-4 sm:space-y-5 border border-white/[0.08] hover:border-white/[0.16] transition-all"
              >
                {/* Header ribbon */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.08]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold font-mono-code flex items-center gap-1.5 ${
                        isCritical
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{isCritical ? 'URGENSI KRITIS' : 'URGENSI TINGGI'}</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[11px] sm:text-xs font-mono-code font-bold font-tabular flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{issue.surge_multiplier}x Lonjakan</span>
                    </span>

                    <span className="text-xs text-zinc-400 font-mono-code flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                      <span>33 Jam</span>
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs font-mono-code font-tabular text-zinc-300 mr-1">
                      Sebutan: <strong className="text-white">{issue.total_mentions_33h}</strong>
                    </span>

                    {onNavigateToMentions && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMentions(issue.id)}
                        className="min-h-10 sm:min-h-8 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs sm:text-[11px] font-semibold text-zinc-100 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        title="Buka seluruh sebutan terkait isu hangat ini di Mentions Stream"
                      >
                        <span>Bedah Sebutan</span>
                        <ArrowRight className="w-3 h-3 text-amber-400" aria-hidden="true" />
                      </button>
                    )}

                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAiWithQuery(
                            `Analisis mendalam isu hangat "${issue.title}" (lonjakan ${issue.surge_multiplier}x, ${issue.total_mentions_33h} sebutan dalam 33 jam, sentimen kritis ${issue.sentiment.neg_percent}%). Jelaskan pemicu opini publik dan langkah respons komunikasi strategis.`,
                            issue.id
                          )
                        }
                        className="min-h-10 sm:min-h-8 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs sm:text-[11px] font-semibold text-amber-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                        title="Tanyakan dan analisis isu hangat ini di AI Copilot"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" aria-hidden="true" />
                        <span>Analisis AI</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Arsipkan isu '${issue.title}' dari Radar Pantauan?`)) {
                          archiveHotIssueMutation.mutate(issue.id);
                        }
                      }}
                      title="Arsipkan dari Radar"
                      className="min-h-10 sm:min-h-8 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs sm:text-[11px] font-mono-code text-zinc-300 hover:text-rose-300 hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    >
                      <Archive className="w-3 h-3" aria-hidden="true" />
                      <span>Arsipkan</span>
                    </button>
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h2 className="font-editorial text-lg sm:text-2xl font-medium text-white leading-snug text-balance">
                    {issue.title}
                  </h2>
                  <p className="text-xs text-zinc-400 font-sans-ui mt-1 leading-relaxed text-pretty">
                    {issue.description}
                  </p>
                </div>

                {/* KPI Triad + Sparkline Curve */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 sm:gap-4">
                  {/* Left: Sentiment Share Bar */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                    <span className="text-[11px] font-mono-code font-bold uppercase text-zinc-400 block">
                      Polaritas Sentimen Publik
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-mono-code font-tabular">
                      <span className="text-emerald-400 font-bold">Positif: {issue.sentiment.pos_percent}%</span>
                      <span className="text-zinc-300 font-bold">Netral: {issue.sentiment.neu_percent}%</span>
                      <span className="text-rose-400 font-bold">Kritis: {issue.sentiment.neg_percent}%</span>
                    </div>
                    {/* Visual Tri-color Bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-white/[0.05]">
                      <div style={{ width: `${issue.sentiment.pos_percent}%` }} className="bg-emerald-500 h-full" />
                      <div style={{ width: `${issue.sentiment.neu_percent}%` }} className="bg-zinc-400 h-full" />
                      <div style={{ width: `${issue.sentiment.neg_percent}%` }} className="bg-rose-500 h-full" />
                    </div>
                    <p className="text-[11px] text-zinc-400 font-sans-ui leading-tight">
                      Sentimen kritis didorong oleh tuntutan transparansi dan kekhawatiran dampak kebijakan.
                    </p>
                  </div>

                  {/* Middle: 33-Hour Activity Curve */}
                  <div className="lg:col-span-2 p-3.5 sm:p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono-code">
                      <span className="font-bold uppercase text-zinc-300 flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
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
                            isAnimationActive={false}
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-mono-code">
                    <span className="font-bold text-zinc-300 flex items-center gap-1.5 uppercase">
                      <MessageSquareText className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                      <span>Suara Netizen &amp; Bukti Lintas Kanal</span>
                    </span>
                    <span className="text-zinc-400 text-[11px]">Urut berdasarkan Resonansi / Likes</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {issue.netizen_quotes.map((q) => (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.12] transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center flex-wrap gap-2">
                            <PlatformBadge
                              provider={q.platform}
                              size="xs"
                              compactLabel
                              isComment={q.is_comment}
                            />
                            <span className="font-semibold text-zinc-200 font-mono-code truncate max-w-[140px]">
                              {q.author}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 font-mono-code text-[10px]">
                            {q.metrics_available !== false && q.likes !== null && q.likes > 0 && (
                              <span className="text-zinc-400 font-tabular">❤️ {q.likes.toLocaleString('id-ID')}</span>
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

                        <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 font-mono-code pt-1 border-t border-white/[0.04]">
                          <span>{q.time_label}</span>
                          <LinkVerificationBadge
                            provider={q.platform}
                            sourceUrl={q.source_url}
                            linkStatus={q.link_status}
                            compact
                            showActionLink
                            actionLabel="Tautan"
                          />
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pantau Isu Hangat Baru"
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-2xl sm:rounded-2xl border border-white/[0.12] bg-[#0c0e14] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4 text-amber-400" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-editorial text-lg font-medium text-white truncate">
                    Pantau Isu Hangat Baru
                  </h2>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Daftarkan wacana viral atau krisis komunikasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup jendela pantau isu"
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans-ui">
              <div>
                <label htmlFor="hot-issue-name" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Judul Isu Hangat *
                </label>
                <input
                  id="hot-issue-name"
                  type="text"
                  placeholder="misal: Dugaan Kebocoran Data Publik"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-11 bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="hot-issue-desc" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Deskripsi / Konteks Isu
                </label>
                <textarea
                  id="hot-issue-desc"
                  rows={2}
                  placeholder="Konteks mengapa isu ini sedang hangat diperbincangkan netizen..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              <div>
                <label htmlFor="hot-issue-keywords" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Kata Kunci Pemantauan (Pisahkan dengan koma) *
                </label>
                <input
                  id="hot-issue-keywords"
                  type="text"
                  placeholder="misal: kebocoran data, audit keamanan, privasi"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="w-full min-h-11 bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors font-mono-code"
                />
              </div>

              <div>
                <span className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Tingkat Urgensi
                </span>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  <label className="min-h-11 sm:min-h-9 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] cursor-pointer text-xs text-zinc-200">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'critical'}
                      onChange={() => setUrgencyLevel('critical')}
                      className="accent-rose-500"
                    />
                    <span className="text-rose-400 font-semibold">Kritis (Surge Tinggi)</span>
                  </label>
                  <label className="min-h-11 sm:min-h-9 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] cursor-pointer text-xs text-zinc-200">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'elevated'}
                      onChange={() => setUrgencyLevel('elevated')}
                      className="accent-amber-500"
                    />
                    <span className="text-amber-400 font-semibold">Tinggi (Meningkat)</span>
                  </label>
                  <label className="min-h-11 sm:min-h-9 flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/[0.08] bg-white/[0.02] cursor-pointer text-xs text-zinc-200">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'normal'}
                      onChange={() => setUrgencyLevel('normal')}
                      className="accent-amber-400"
                    />
                    <span className="text-amber-300 font-semibold">Normal</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-11 px-4 py-2 rounded-xl border border-white/[0.12] text-zinc-200 hover:bg-white/[0.06] transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!name.trim() || createHotIssueMutation.isPending}
                onClick={() => createHotIssueMutation.mutate()}
                className="min-h-11 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold disabled:opacity-50 transition-colors cursor-pointer"
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

