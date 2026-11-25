import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, TopicItem, AiTopicSummary } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  Plus,
  RefreshCw,
  Target,
  X,
  Check,
  Tag,
  Flame,
  Activity,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MessageSquareText,
  PauseCircle,
  PlayCircle,
  Archive,
} from 'lucide-react';
import { PlatformBadge } from '@/components/common/PlatformBadge';

const DEFAULT_TOPIC_PROVIDERS = ['rss', 'youtube', 'threads', 'facebook', 'instagram', 'x', 'tiktok'];
const SOCIAL_ONLY_PROVIDERS = ['youtube', 'threads', 'facebook', 'instagram', 'x', 'tiktok'];

interface TopicsPageProps {
  onNavigateToMentions?: (topicId: number) => void;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

export function TopicsPage({ onNavigateToMentions, onOpenAiWithQuery }: TopicsPageProps = {}) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [syncingTopicId, setSyncingTopicId] = useState<number | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // AI Topic Summary Modal State
  const [summaryTopic, setSummaryTopic] = useState<TopicItem | null>(null);
  const [summaryData, setSummaryData] = useState<AiTopicSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeKeywords, setIncludeKeywords] = useState('');
  const [excludeKeywords, setExcludeKeywords] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(DEFAULT_TOPIC_PROVIDERS);

  // Handle escape key to close modals (R-32)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (summaryTopic) setSummaryTopic(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, summaryTopic]);

  // Fetch active and paused Topics for zero-touch lifecycle management
  const { data: topics, isLoading } = useQuery({
    queryKey: ['topics-list', workspaceId, 'manage'],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ data: TopicItem[] }>(`/workspaces/${workspaceId}/topics`, {
        params: { status: 'manage' },
      });
      return res.data.data;
    },
  });

  // Create Topic Mutation (with zero-touch alerts + initial sync)
  const createTopicMutation = useMutation({
    mutationFn: async () => {
      const inc = includeKeywords.split(',').map((s) => s.trim()).filter(Boolean);
      const exc = excludeKeywords.split(',').map((s) => s.trim()).filter(Boolean);

      const res = await api.post(`/workspaces/${workspaceId}/topics`, {
        name,
        description,
        include_keywords: inc,
        exclude_keywords: exc,
        providers: selectedProviders,
      });
      return res.data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      queryClient.invalidateQueries({ queryKey: ['alerts-data'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setIncludeKeywords('');
      setExcludeKeywords('');
      setSelectedProviders(DEFAULT_TOPIC_PROVIDERS);
      setFeedbackMsg(
        res?.message || 'Topik pemantauan baru berhasil dibuat, aturan alert otomatis aktif, dan sinkronisasi awal selesai.'
      );
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
  });

  // Update Topic Status (Pause / Resume) Mutation
  const updateTopicStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'paused' }) => {
      const res = await api.patch(`/topics/${id}`, { status });
      return res.data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setFeedbackMsg(res?.message || 'Status topik berhasil diperbarui.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
  });

  // Archive Topic Mutation
  const archiveTopicMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/topics/${id}`);
      return res.data;
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setFeedbackMsg(res?.message || 'Topik berhasil diarsipkan.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
  });

  // Sync Topic Mutation
  const handleSyncTopic = async (topicId: number) => {
    setSyncingTopicId(topicId);
    try {
      const res = await api.post(`/topics/${topicId}/sync`);
      queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      setFeedbackMsg(res.data.message || 'Sinkronisasi topik berhasil diselesaikan.');
    } catch {
      setFeedbackMsg('Gagal melakukan sinkronisasi topik.');
    } finally {
      setSyncingTopicId(null);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  const handleViewAiSummary = async (topic: TopicItem, forceRefresh = false) => {
    setSummaryTopic(topic);
    setIsSummaryLoading(true);
    setSummaryData(null);
    try {
      const res = await api.get<{ status: string; data: AiTopicSummary }>(`/topics/${topic.id}/ai-summary`, {
        params: { refresh: forceRefresh }
      });
      setSummaryData(res.data.data);
    } catch {
      setFeedbackMsg('Gagal memuat ringkasan eksekutif AI untuk topik ini.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const toggleProvider = (provider: string) => {
    if (selectedProviders.includes(provider)) {
      if (selectedProviders.length > 1) {
        setSelectedProviders(selectedProviders.filter((p) => p !== provider));
      }
    } else {
      setSelectedProviders([...selectedProviders, provider]);
    }
  };

  const topicItems = topics || [];
  const totalTrackedMentions = topicItems.reduce((acc, t) => acc + (t.mentions_count || 0), 0);
  const highestTopic = topicItems.reduce<TopicItem | null>((max, t) => {
    if (!max || t.mentions_count > max.mentions_count) return t;
    return max;
  }, null);

  return (
    <div className="space-y-4 sm:space-y-6 font-sans-ui">
      {/* Page Header */}
      <div className="border-b border-white/[0.08] pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3.5 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shadow-xs shrink-0 mt-0.5 sm:mt-0">
            <Target className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="font-editorial text-xl sm:text-2xl font-medium text-white tracking-tight text-balance">
              Radar Topik &amp; Manajemen Isu
            </h1>
            <p className="text-xs text-zinc-400 font-sans-ui mt-0.5 text-pretty">
              Konfigurasi entitas pantau, kata kunci inklusi, eksklusi, dan status akselerasi tren publik
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="w-full sm:w-auto min-h-11 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Tambah Topik Baru</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{feedbackMsg}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMsg(null)} className="min-w-9 min-h-9 flex items-center justify-center text-zinc-300 hover:text-white shrink-0" aria-label="Tutup pesan">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Top Bento Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Topik Aktif Dipantau
            </span>
            <div className="text-2xl font-extrabold text-white font-mono-code font-tabular">
              {topicItems.length} <span className="text-xs font-normal text-zinc-400 font-sans-ui">Entitas</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Topik Terhangat Hari Ini
            </span>
            <div className="text-sm font-bold text-white truncate">
              {highestTopic ? highestTopic.name : 'Belum Terdeteksi'}
            </div>
            <span className="text-[11px] text-amber-400 font-mono-code font-tabular">
              {highestTopic ? `${highestTopic.mentions_count} Sebutan` : ''}
            </span>
          </div>
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>

        <div className="bento-card p-4 sm:p-5 bg-[#0e1117] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-semibold text-zinc-400 font-mono-code block mb-1">
              Total Sebutan Terpetakan
            </span>
            <div className="text-2xl font-extrabold text-white font-mono-code font-tabular">
              {totalTrackedMentions.toLocaleString('id-ID')}
            </div>
          </div>
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <Activity className="w-4 h-4" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Topic Cards Grid (1 col mobile -> 2 col tablet & desktop) */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-2xl bg-white/[0.03] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : topicItems.length === 0 ? (
        <div className="bento-card p-10 sm:p-12 text-center bg-[#0e1117]">
          <Target className="w-10 h-10 text-zinc-500 mx-auto mb-3" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-white mb-1">Belum Ada Topik Pemantauan</h3>
          <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4 font-sans-ui">
            Buat topik baru untuk mulai memantau percakapan publik di media digital terhubung.
          </p>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-bold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>Buat Topik Pertama</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {topicItems.map((topic, idx) => {
            const isSyncing = syncingTopicId === topic.id;
            const incKws = topic.keywords.filter((k) => k.type === 'include');
            const pos = topic.positive_count ?? 0;
            const neu = topic.neutral_count ?? 0;
            const neg = topic.negative_count ?? 0;
            const totalSent = pos + neu + neg;
            const posPct = totalSent > 0 ? Math.round((pos / totalSent) * 100) : 0;
            const neuPct = totalSent > 0 ? Math.round((neu / totalSent) * 100) : 0;
            const negPct = totalSent > 0 ? Math.round((neg / totalSent) * 100) : 0;

            const isTopTopic = idx === 0 && topic.mentions_count > 0;
            const isPaused = topic.status === 'paused';

            return (
              <div
                key={topic.id}
                className={`bento-card p-4 sm:p-5 bg-[#0c0f16] border flex flex-col justify-between transition-all hover:border-white/20 shadow-lg min-w-0 ${
                  isPaused
                    ? 'opacity-75 border-zinc-700/60'
                    : isTopTopic
                    ? 'border-amber-500/40 bg-gradient-to-br from-[#121624] to-[#0c0f16]'
                    : 'border-white/[0.08]'
                }`}
              >
                {/* Top Section */}
                <div className="space-y-3.5">
                  {/* Header Row: Rank, Title, and Main Mentions KPI */}
                  <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                    <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                      {/* Rank Indicator */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono-code text-xs font-bold shrink-0 mt-0.5 border ${
                        isTopTopic
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20'
                          : 'bg-white/[0.04] text-zinc-300 border-white/[0.08]'
                      }`}>
                        #{idx + 1}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h2 className="font-editorial text-base sm:text-lg font-medium text-white tracking-tight leading-snug break-words">
                            {topic.name}
                          </h2>
                          {isPaused && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-zinc-700/50 text-zinc-200 border border-zinc-500/40">
                              DIJEDA
                            </span>
                          )}
                          {isTopTopic && !isPaused && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                              <Flame className="w-3 h-3 text-amber-400" aria-hidden="true" /> Terbanyak
                            </span>
                          )}
                        </div>
                        {topic.description && (
                          <p className="text-[11.5px] text-zinc-400 mt-0.5 line-clamp-1 font-sans-ui">
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Prominent Bold Mention KPI */}
                    <div className="text-right shrink-0 bg-white/[0.03] border border-white/[0.06] rounded-xl px-2.5 sm:px-3 py-1.5">
                      <div className="text-lg sm:text-2xl font-black font-mono-code font-tabular text-white tracking-tight">
                        {topic.mentions_count.toLocaleString('id-ID')}
                      </div>
                      <span className="text-[10px] text-zinc-400 font-sans-ui block -mt-0.5">
                        sebutan
                      </span>
                    </div>
                  </div>

                  {/* Sentiment Barometer Strip */}
                  <div className="p-2.5 rounded-xl bg-black/30 border border-white/[0.05] space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono-code">
                      <span className="text-zinc-400 font-medium">Distribusi Sentimen:</span>
                      {totalSent > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 font-tabular">
                          <span className="text-emerald-400 font-semibold">{posPct}% Pos</span>
                          <span className="text-zinc-300 font-semibold">{neuPct}% Net</span>
                          <span className="text-rose-400 font-semibold">{negPct}% Neg</span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic">Belum ada sebutan masuk</span>
                      )}
                    </div>

                    <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden flex border border-white/[0.06]">
                      {totalSent > 0 ? (
                        <>
                          <div style={{ width: `${posPct}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Positif: ${posPct}% (${pos})`} />
                          <div style={{ width: `${neuPct}%` }} className="h-full bg-zinc-600 transition-all duration-300" title={`Netral: ${neuPct}% (${neu})`} />
                          <div style={{ width: `${negPct}%` }} className="h-full bg-rose-500 transition-all duration-300" title={`Negatif: ${negPct}% (${neg})`} />
                        </>
                      ) : (
                        <div className="w-full h-full bg-zinc-800" />
                      )}
                    </div>
                  </div>

                  {/* Compact Keywords Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <Tag className="w-3 h-3 text-zinc-400 shrink-0" aria-hidden="true" />
                    {incKws.slice(0, 3).map((kw) => (
                      <span
                        key={kw.id}
                        className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono-code"
                      >
                        +{kw.keyword}
                      </span>
                    ))}
                    {incKws.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded-md bg-white/[0.04] text-zinc-400 border border-white/[0.06] text-[10px] font-mono-code">
                        +{incKws.length - 3} lainnya
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Platforms & Clean 3x2 Mobile Action Grid */}
                <div className="flex flex-col gap-3 pt-3 mt-3 border-t border-white/[0.06]">
                  <div className="flex items-center flex-wrap gap-1">
                    {(topic.providers && topic.providers.length > 0 ? topic.providers : ['rss']).map((prov) => (
                      <PlatformBadge key={prov} provider={prov} size="xs" compactLabel />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5">
                    {onNavigateToMentions && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMentions(topic.id)}
                        className="min-h-10 sm:min-h-8 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-[11.5px] sm:text-xs text-amber-300 font-semibold transition-all cursor-pointer shadow-xs"
                        title="Buka seluruh dokumen sebutan topik ini di Mentions Explorer"
                      >
                        <MessageSquareText className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">Sebutan</span>
                      </button>
                    )}

                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() => onOpenAiWithQuery(
                          `Konsultasi intelijen strategis untuk program ${topic.name}: jelaskan dinamika polaritas sentimen publik, isu paling kontroversial atau apresiatif, dan saran tindak lanjut komunikasinya.`,
                          topic.id
                        )}
                        className="min-h-10 sm:min-h-8 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-500/35 bg-amber-500/15 hover:bg-amber-500/25 text-[11.5px] sm:text-xs text-amber-200 font-semibold transition-all cursor-pointer shadow-xs"
                        title="Tanyakan dan analisis topik ini langsung di Asisten AI TRINETRA"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                        <span className="truncate">Tanya AI</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleViewAiSummary(topic)}
                      className="min-h-10 sm:min-h-8 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.08] text-[11.5px] sm:text-xs text-zinc-200 font-semibold transition-all cursor-pointer shadow-xs"
                      title="Lihat Sintesis Analisis AI"
                    >
                      <FileText className="w-3.5 h-3.5 text-zinc-300 shrink-0" aria-hidden="true" />
                      <span className="truncate">Ringkasan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSyncTopic(topic.id)}
                      disabled={isSyncing || isPaused}
                      className="min-h-10 sm:min-h-8 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-[11.5px] sm:text-xs text-white font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin text-amber-400' : ''}`} aria-hidden="true" />
                      <span className="truncate">{isSyncing ? 'Sinkron...' : 'Sinkron'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateTopicStatusMutation.mutate({
                          id: topic.id,
                          status: isPaused ? 'active' : 'paused',
                        })
                      }
                      disabled={updateTopicStatusMutation.isPending}
                      title={isPaused ? 'Aktifkan kembali pemantauan topik ini' : 'Jeda sementara pemantauan topik ini'}
                      className={`min-h-10 sm:min-h-8 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11.5px] sm:text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${
                        isPaused
                          ? 'border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300'
                          : 'border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-zinc-200'
                      }`}
                    >
                      {isPaused ? (
                        <>
                          <PlayCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">Aktifkan</span>
                        </>
                      ) : (
                        <>
                          <PauseCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">Jeda</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Arsipkan topik '${topic.name}' dari daftar pemantauan aktif?`)) {
                          archiveTopicMutation.mutate(topic.id);
                        }
                      }}
                      disabled={archiveTopicMutation.isPending}
                      title="Arsipkan topik dari pemantauan aktif"
                      aria-label={`Arsipkan topik ${topic.name}`}
                      className="min-h-10 sm:min-h-8 flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-rose-500/15 hover:border-rose-500/35 text-[11.5px] sm:text-xs text-zinc-300 hover:text-rose-300 font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                    >
                      <Archive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Arsip</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Topic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buat Topik Pemantauan Baru"
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-2xl sm:rounded-2xl border border-white/[0.12] bg-[#0c0e14] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                  <Target className="w-4 h-4" aria-hidden="true" />
                </div>
                <h2 className="font-editorial text-lg font-medium text-white truncate">
                  Buat Topik Pemantauan Baru
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer shrink-0"
                aria-label="Tutup formulir"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="topic-create-name" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Nama Topik Pemantauan *
                </label>
                <input
                  id="topic-create-name"
                  type="text"
                  placeholder="Contoh: Kualitas Kebijakan Publik"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full min-h-11 bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label htmlFor="topic-create-desc" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Deskripsi / Konteks Pemantauan
                </label>
                <textarea
                  id="topic-create-desc"
                  rows={2}
                  placeholder="Catatan tujuan atau fokus pemantauan isu..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label htmlFor="topic-create-include" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Kata Kunci Pantau (Pisahkan Koma) *
                </label>
                <input
                  id="topic-create-include"
                  type="text"
                  placeholder="Contoh: Pemerintah, kebijakan, anggaran"
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                  className="w-full min-h-11 bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors shadow-xs"
                />
              </div>

              <div>
                <label htmlFor="topic-create-exclude" className="block text-zinc-200 font-semibold mb-1.5 text-xs">
                  Kata Kunci Pengecualian / Exclude (Pisahkan Koma)
                </label>
                <input
                  id="topic-create-exclude"
                  type="text"
                  placeholder="Contoh: lowongan, karir, promo, spam"
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  className="w-full min-h-11 bg-white/[0.03] border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-white text-base sm:text-xs placeholder:text-zinc-400 focus:outline-none focus:border-amber-400/60 transition-colors shadow-xs"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="block text-zinc-200 font-semibold text-xs">
                    Pilih Platform Sumber Data ({selectedProviders.length}/7 aktif)
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono-code">
                    <button
                      type="button"
                      onClick={() => setSelectedProviders(DEFAULT_TOPIC_PROVIDERS)}
                      className="min-h-8 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 cursor-pointer transition-colors"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProviders(SOCIAL_ONLY_PROVIDERS)}
                      className="min-h-8 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 cursor-pointer transition-colors"
                    >
                      Sosial
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProviders(['rss'])}
                      className="min-h-8 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 cursor-pointer transition-colors"
                    >
                      Berita
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'rss', label: 'Berita (RSS)' },
                    { key: 'youtube', label: 'YouTube' },
                    { key: 'threads', label: 'Threads (Muse)' },
                    { key: 'instagram', label: 'Instagram (Muse)' },
                    { key: 'facebook', label: 'Facebook (Muse)' },
                    { key: 'x', label: 'Twitter / X' },
                    { key: 'tiktok', label: 'TikTok' },
                  ].map((prov) => (
                    <label
                      key={prov.key}
                      className="min-h-11 flex items-center gap-2 cursor-pointer text-zinc-200 text-xs px-2.5 py-2 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.05]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProviders.includes(prov.key)}
                        onChange={() => toggleProvider(prov.key)}
                        className="w-4 h-4 rounded border-white/[0.15] bg-white/[0.05] accent-amber-400"
                      />
                      <span>{prov.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-white/[0.08] text-xs">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-h-11 px-4 py-2 rounded-xl border border-white/[0.12] text-zinc-200 hover:bg-white/[0.06] transition-colors font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!name.trim() || !includeKeywords.trim() || selectedProviders.length === 0 || createTopicMutation.isPending}
                onClick={() => createTopicMutation.mutate()}
                className="min-h-11 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold disabled:opacity-50 transition-colors shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                {createTopicMutation.isPending ? 'Menyimpan...' : 'Simpan & Aktifkan Otomatis'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Executive Intelligence Briefing Modal */}
      {summaryTopic && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ringkasan Eksekutif AI"
            className="w-full max-w-2xl rounded-t-2xl sm:rounded-2xl border border-white/[0.12] bg-[#0d101a] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-4 sm:space-y-5 shadow-2xl max-h-[90dvh] overflow-y-auto overscroll-y-contain"
          >
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-3.5 sm:pb-4">
              <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center shadow-xs shrink-0">
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <h2 className="font-editorial text-lg sm:text-xl font-medium text-white tracking-tight">
                      Executive Intelligence Briefing
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono-code font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      SINTESIS AI
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-sans-ui mt-0.5 truncate">
                    Program: <strong className="text-white font-medium">{summaryTopic.name}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleViewAiSummary(summaryTopic, true)}
                  disabled={isSummaryLoading}
                  aria-label="Muat ulang ringkasan AI"
                  className="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center text-zinc-300 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors"
                  title="Perbarui ringkasan live"
                >
                  <RefreshCw className={`w-4 h-4 ${isSummaryLoading ? 'animate-spin text-amber-400' : ''}`} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryTopic(null)}
                  aria-label="Tutup ringkasan AI"
                  className="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center text-zinc-300 hover:text-white rounded-xl hover:bg-white/[0.08] transition-colors"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            {isSummaryLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-300 text-xs">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400" aria-hidden="true" />
                <span>Sedang merangkum sebutan dan sentimen terkini...</span>
              </div>
            ) : summaryData ? (
              <div className="space-y-4 text-xs">
                
                {/* Meta Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Total Sebutan Dianalisis:</span>
                    <strong className="text-white font-mono-code font-tabular">{summaryData.mentions_analyzed}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">Kecenderungan Sentimen:</span>
                    <span className={`px-2 py-0.5 rounded-md uppercase font-bold text-[10px] ${
                      summaryData.dominant_sentiment === 'positive' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      summaryData.dominant_sentiment === 'negative' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      'bg-zinc-800 text-zinc-300 border border-zinc-700'
                    }`}>
                      {summaryData.dominant_sentiment}
                    </span>
                  </div>
                </div>

                {/* Executive Overview */}
                <div className="p-4 rounded-xl bg-[#131622] border border-white/[0.08] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold uppercase text-[11px] tracking-wider">
                    <FileText className="w-3.5 h-3.5" />
                    <span>Ringkasan Situasi Publik</span>
                  </div>
                  <p className="text-[13px] text-zinc-200 leading-relaxed font-sans-ui">
                    {summaryData.executive_overview}
                  </p>
                </div>

                {/* Positive and Critical Themes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Positives */}
                  <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] uppercase">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Sorotan Positif Utama</span>
                    </div>
                    <ul className="space-y-1.5 text-zinc-300">
                      {summaryData.key_positive_themes && summaryData.key_positive_themes.length > 0 ? (
                        summaryData.key_positive_themes.map((theme, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            <span>{theme}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-zinc-500 italic">Tidak ada tema positif menonjol.</li>
                      )}
                    </ul>
                  </div>

                  {/* Critical Issues */}
                  <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-800/20 space-y-2">
                    <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-[11px] uppercase">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Kekhawatiran / Isu Kritis</span>
                    </div>
                    <ul className="space-y-1.5 text-zinc-300">
                      {summaryData.key_critical_themes && summaryData.key_critical_themes.length > 0 ? (
                        summaryData.key_critical_themes.map((theme, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-rose-400 mt-0.5">•</span>
                            <span>{theme}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-zinc-500 italic">Tidak ada isu kritis menonjol.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Recommendations */}
                {summaryData.strategic_recommendations && summaryData.strategic_recommendations.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                    <div className="font-semibold text-zinc-300 text-[11px] uppercase tracking-wider">
                      Rekomendasi Respons &amp; Kebijakan Komunikasi
                    </div>
                    <ul className="space-y-1 text-zinc-300">
                      {summaryData.strategic_recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-amber-400 mt-0.5">→</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.08] text-xs">
              <span className="text-zinc-500 font-mono-code text-[11px]">
                {summaryData?.cached_at ? `Diperbarui: ${new Date(summaryData.cached_at).toLocaleTimeString()}` : ''}
              </span>
              <button
                type="button"
                onClick={() => setSummaryTopic(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium transition-colors cursor-pointer"
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
