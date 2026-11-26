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

  const [summaryTopic, setSummaryTopic] = useState<TopicItem | null>(null);
  const [summaryData, setSummaryData] = useState<AiTopicSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [includeKeywords, setIncludeKeywords] = useState('');
  const [excludeKeywords, setExcludeKeywords] = useState('');
  const [selectedProviders, setSelectedProviders] = useState<string[]>(DEFAULT_TOPIC_PROVIDERS);

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

  const createTopicMutation = useMutation({
    mutationFn: async () => {
      const inc = includeKeywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const exc = excludeKeywords
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await api.post(`/workspaces/${workspaceId}/topics`, {
        name,
        description,
        include_keywords: inc,
        exclude_keywords: exc,
        providers: selectedProviders,
      });
      return res.data;
    },
    onSuccess: (res: { message?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      void queryClient.invalidateQueries({ queryKey: ['alerts-data'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setIncludeKeywords('');
      setExcludeKeywords('');
      setSelectedProviders(DEFAULT_TOPIC_PROVIDERS);
      setFeedbackMsg(
        res?.message ||
          'Topik pemantauan baru berhasil dibuat, aturan alert otomatis aktif, dan sinkronisasi awal selesai.'
      );
      setTimeout(() => setFeedbackMsg(null), 5000);
    },
  });

  const updateTopicStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'active' | 'paused' }) => {
      const res = await api.patch(`/topics/${id}`, { status });
      return res.data;
    },
    onSuccess: (res: { message?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setFeedbackMsg(res?.message || 'Status topik berhasil diperbarui.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
  });

  const archiveTopicMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/topics/${id}`);
      return res.data;
    },
    onSuccess: (res: { message?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      setFeedbackMsg(res?.message || 'Topik berhasil diarsipkan.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    },
  });

  const handleSyncTopic = async (topicId: number) => {
    setSyncingTopicId(topicId);
    try {
      const res = await api.post(`/topics/${topicId}/sync`);
      void queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
      void queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
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
      const res = await api.get<{ status: string; data: AiTopicSummary }>(
        `/topics/${topic.id}/ai-summary`,
        { params: { refresh: forceRefresh } }
      );
      setSummaryData(res.data.data);
    } catch {
      setFeedbackMsg('Gagal memuat ringkasan eksekutif AI untuk topik ini.');
      setTimeout(() => setFeedbackMsg(null), 4000);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const toggleProvider = (prov: string) => {
    if (selectedProviders.includes(prov)) {
      if (selectedProviders.length > 1) {
        setSelectedProviders(selectedProviders.filter((p) => p !== prov));
      }
    } else {
      setSelectedProviders([...selectedProviders, prov]);
    }
  };

  const topicItems = topics || [];
  const totalTrackedMentions = topicItems.reduce((acc, t) => acc + (t.mentions_count || 0), 0);
  const highestTopic = topicItems.reduce<TopicItem | null>((max, t) => {
    if (!max || t.mentions_count > max.mentions_count) return t;
    return max;
  }, null);

  return (
    <div className="space-y-6 font-sans-ui animate-surface-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--text-primary)] tracking-tight">
            Program Prioritas &amp; Topik Pantau
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Kelola entitas pantau, kata kunci inklusi dan eksklusi, serta sinkronisasi lintas saluran.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="btn-contrast w-full sm:w-auto min-h-11 px-5 text-xs inline-flex items-center justify-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>Tambah Topik Baru</span>
        </button>
      </div>

      {feedbackMsg && (
        <div
          role="status"
          className="p-3.5 rounded-2xl border border-[var(--sentiment-pos-border)] bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] text-xs font-medium flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="min-w-9 min-h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] shrink-0"
            aria-label="Tutup pesan"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Unified Summary Dock */}
      <div className="surface-card p-5 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-muted)] block">Topik Terdaftar</span>
              <div className="text-2xl font-bold text-[var(--text-primary)] font-tabular">
                {topicItems.length}{' '}
                <span className="text-xs font-normal text-[var(--text-secondary)]">entitas</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] flex items-center justify-center shrink-0">
              <Target className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 sm:border-l sm:border-[var(--border-subtle)] sm:pl-5">
            <div className="min-w-0 flex-1 space-y-1">
              <span className="text-xs text-[var(--text-muted)] block">Volume Tertinggi</span>
              <div className="text-sm font-bold text-[var(--text-primary)] truncate">
                {highestTopic ? highestTopic.name : 'Belum terdeteksi'}
              </div>
              {highestTopic && (
                <span className="text-xs text-[var(--accent-gold-text)] font-semibold font-tabular">
                  {highestTopic.mentions_count.toLocaleString('id-ID')} sebutan
                </span>
              )}
            </div>
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] flex items-center justify-center shrink-0">
              <Flame className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 sm:border-l sm:border-[var(--border-subtle)] sm:pl-5">
            <div className="space-y-1">
              <span className="text-xs text-[var(--text-muted)] block">Total Sebutan Terpetakan</span>
              <div className="text-2xl font-bold text-[var(--text-primary)] font-tabular">
                {totalTrackedMentions.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] flex items-center justify-center shrink-0">
              <Activity className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* Topic Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" role="status" aria-label="Memuat topik">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-52 surface-card animate-pulse" />
          ))}
        </div>
      ) : topicItems.length === 0 ? (
        <div className="surface-card p-10 sm:p-12 text-center space-y-3">
          <Target className="w-9 h-9 text-[var(--text-muted)] mx-auto" aria-hidden="true" />
          <h2 className="font-editorial text-xl text-[var(--text-primary)]">Belum Ada Topik Pemantauan</h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
            Tambahkan topik pertama untuk mulai memantau percakapan publik lintas media dan media sosial.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="btn-contrast min-h-11 px-5 text-xs inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Buat Topik Pertama</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
              <article
                key={topic.id}
                className={`surface-card p-5 sm:p-6 flex flex-col justify-between gap-4 min-w-0 ${
                  isPaused
                    ? 'opacity-75'
                    : isTopTopic
                      ? 'border-[var(--accent-gold-border)]'
                      : ''
                }`}
              >
                <div className="space-y-4">
                  {/* Top Row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-tabular text-xs font-bold shrink-0 mt-0.5 border ${
                          isTopTopic
                            ? 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]'
                            : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                        }`}
                      >
                        #{idx + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="font-editorial text-lg font-medium text-[var(--text-primary)] leading-snug break-words">
                            {topic.name}
                          </h2>
                          {isPaused && (
                            <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-semibold bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                              Dijeda
                            </span>
                          )}
                          {isTopTopic && !isPaused && (
                            <span className="px-2 py-0.5 rounded-lg text-[10.5px] font-semibold bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border border-[var(--accent-gold-border)] inline-flex items-center gap-1">
                              <Flame className="w-3 h-3" aria-hidden="true" />
                              <span>Terbanyak</span>
                            </span>
                          )}
                        </div>
                        {topic.description && (
                          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-1">
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 surface-inset px-3 py-1.5">
                      <div className="text-xl font-bold font-tabular text-[var(--text-primary)] leading-tight">
                        {topic.mentions_count.toLocaleString('id-ID')}
                      </div>
                      <span className="text-[10.5px] text-[var(--text-muted)] block">sebutan</span>
                    </div>
                  </div>

                  {/* Sentiment Strip */}
                  <div className="surface-inset p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-[var(--text-muted)] font-medium">Sentimen</span>
                      {totalSent > 0 ? (
                        <div className="flex flex-wrap items-center gap-2.5 font-tabular text-[11px] font-semibold">
                          <span className="text-[var(--sentiment-pos)]">{posPct}% Pos</span>
                          <span className="text-[var(--text-secondary)]">{neuPct}% Net</span>
                          <span className="text-[var(--sentiment-neg)]">{negPct}% Neg</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-[var(--text-muted)]">Belum ada sebutan</span>
                      )}
                    </div>

                    <div className="w-full h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden flex gap-0.5">
                      {totalSent > 0 ? (
                        <>
                          <div style={{ width: `${posPct}%` }} className="h-full bg-[var(--sentiment-pos-bar)]" />
                          <div style={{ width: `${neuPct}%` }} className="h-full bg-[var(--sentiment-neu-bar)]" />
                          <div style={{ width: `${negPct}%` }} className="h-full bg-[var(--sentiment-neg-bar)]" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-[var(--border-subtle)]" />
                      )}
                    </div>
                  </div>

                  {/* Keywords */}
                  {incKws.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Tag className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                      {incKws.slice(0, 3).map((kw) => (
                        <span
                          key={kw.id}
                          className="px-2 py-0.5 rounded-lg bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] text-[11px] font-medium"
                        >
                          +{kw.keyword}
                        </span>
                      ))}
                      {incKws.length > 3 && (
                        <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] text-[11px]">
                          +{incKws.length - 3} lainnya
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Platforms & Actions */}
                <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center flex-wrap gap-1.5">
                    {(topic.providers && topic.providers.length > 0 ? topic.providers : ['rss']).map((prov) => (
                      <PlatformBadge key={prov} provider={prov} size="xs" compactLabel />
                    ))}
                  </div>

                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5">
                    {onNavigateToMentions && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMentions(topic.id)}
                        className="min-h-10 sm:min-h-9 px-3 rounded-xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[var(--accent-gold-text)] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
                      >
                        <MessageSquareText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">Sebutan</span>
                      </button>
                    )}

                    {onOpenAiWithQuery && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenAiWithQuery(
                            `Konsultasi intelijen strategis untuk program ${topic.name}: jelaskan dinamika polaritas sentimen publik, isu paling kontroversial atau apresiatif, dan saran tindak lanjut komunikasinya.`,
                            topic.id
                          )
                        }
                        className="btn-ghost-surface min-h-10 sm:min-h-9 px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                      >
                        <span className="truncate">Tanya AI</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleViewAiSummary(topic)}
                      className="btn-ghost-surface min-h-10 sm:min-h-9 px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                      <span className="truncate">Ringkasan</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleSyncTopic(topic.id)}
                      disabled={isSyncing || isPaused}
                      className="btn-ghost-surface min-h-10 sm:min-h-9 px-3 text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin text-[var(--accent-gold-text)]' : ''}`}
                        aria-hidden="true"
                      />
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
                      className={`min-h-10 sm:min-h-9 px-3 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 ${
                        isPaused
                          ? 'border-[var(--sentiment-pos-border)] bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)]'
                          : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'
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
                      aria-label={`Arsipkan topik ${topic.name}`}
                      className="min-h-10 sm:min-h-9 px-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--sentiment-neg-subtle)] hover:border-[var(--sentiment-neg-border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--sentiment-neg)] inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Archive className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">Arsip</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Topic Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg-backdrop)] backdrop-blur-xs p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buat Topik Pemantauan Baru"
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-3xl sm:rounded-3xl border border-[var(--border-medium)] bg-[var(--bg-surface)] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-5 shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
              <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)] truncate">
                Buat Topik Pemantauan Baru
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] shrink-0"
                aria-label="Tutup formulir"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="topic-create-name" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Nama Topik Pemantauan *
                </label>
                <input
                  id="topic-create-name"
                  type="text"
                  placeholder="Contoh: Kualitas Kebijakan Publik"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full min-h-11 px-3.5 py-2.5 text-base sm:text-xs"
                />
              </div>

              <div>
                <label htmlFor="topic-create-desc" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Deskripsi / Konteks Pemantauan
                </label>
                <textarea
                  id="topic-create-desc"
                  rows={2}
                  placeholder="Catatan tujuan atau fokus pemantauan isu..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field w-full px-3.5 py-2.5 text-base sm:text-xs"
                />
              </div>

              <div>
                <label htmlFor="topic-create-include" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Kata Kunci Pantau (pisahkan koma) *
                </label>
                <input
                  id="topic-create-include"
                  type="text"
                  placeholder="Contoh: Pemerintah, kebijakan, anggaran"
                  value={includeKeywords}
                  onChange={(e) => setIncludeKeywords(e.target.value)}
                  className="input-field w-full min-h-11 px-3.5 py-2.5 text-base sm:text-xs"
                />
              </div>

              <div>
                <label htmlFor="topic-create-exclude" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Kata Kunci Pengecualian (pisahkan koma)
                </label>
                <input
                  id="topic-create-exclude"
                  type="text"
                  placeholder="Contoh: lowongan, karir, promo, spam"
                  value={excludeKeywords}
                  onChange={(e) => setExcludeKeywords(e.target.value)}
                  className="input-field w-full min-h-11 px-3.5 py-2.5 text-base sm:text-xs"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-[var(--text-primary)] font-semibold">
                    Platform Sumber Data ({selectedProviders.length}/7 aktif)
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setSelectedProviders(DEFAULT_TOPIC_PROVIDERS)}
                      className="btn-ghost-surface min-h-8 px-2.5 font-medium"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProviders(SOCIAL_ONLY_PROVIDERS)}
                      className="btn-ghost-surface min-h-8 px-2.5 font-medium"
                    >
                      Sosial
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedProviders(['rss'])}
                      className="btn-ghost-surface min-h-8 px-2.5 font-medium"
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
                      className="min-h-11 flex items-center gap-2 cursor-pointer text-[var(--text-primary)] text-xs px-3 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProviders.includes(prov.key)}
                        onChange={() => toggleProvider(prov.key)}
                        className="w-4 h-4 rounded accent-[var(--accent-gold)]"
                      />
                      <span>{prov.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-[var(--border-subtle)] text-xs">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn-ghost-surface min-h-11 px-4 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={
                  !name.trim() ||
                  !includeKeywords.trim() ||
                  selectedProviders.length === 0 ||
                  createTopicMutation.isPending
                }
                onClick={() => createTopicMutation.mutate()}
                className="btn-contrast min-h-11 px-5 disabled:opacity-50"
              >
                {createTopicMutation.isPending ? 'Menyimpan...' : 'Simpan & Aktifkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Topic Summary Modal */}
      {summaryTopic && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg-backdrop)] backdrop-blur-xs p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ringkasan Eksekutif Topik"
            className="w-full max-w-2xl rounded-t-3xl sm:rounded-3xl border border-[var(--border-medium)] bg-[var(--bg-surface)] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-5 shadow-[var(--shadow-elevated)] max-h-[90dvh] overflow-y-auto overscroll-y-contain"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div className="min-w-0">
                <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
                  Ringkasan Eksekutif Topik
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">
                  Program: <strong className="text-[var(--text-primary)]">{summaryTopic.name}</strong>
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleViewAiSummary(summaryTopic, true)}
                  disabled={isSummaryLoading}
                  aria-label="Muat ulang ringkasan"
                  className="min-w-10 min-h-10 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isSummaryLoading ? 'animate-spin text-[var(--accent-gold-text)]' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryTopic(null)}
                  aria-label="Tutup ringkasan"
                  className="min-w-10 min-h-10 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            {isSummaryLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-[var(--text-secondary)] text-xs">
                <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-gold-text)]" aria-hidden="true" />
                <span>Merangkum sebutan dan arah sentimen terbaru...</span>
              </div>
            ) : summaryData ? (
              <div className="space-y-4 text-xs">
                <div className="surface-inset p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-[var(--text-muted)]">Sebutan dianalisis: </span>
                    <strong className="text-[var(--text-primary)] font-tabular">
                      {summaryData.mentions_analyzed}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">Dominan:</span>
                    <span
                      className={`px-2 py-0.5 rounded-lg font-semibold capitalize border ${
                        summaryData.dominant_sentiment === 'positive'
                          ? 'bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border-[var(--sentiment-pos-border)]'
                          : summaryData.dominant_sentiment === 'negative'
                            ? 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                            : 'bg-[var(--sentiment-neu-subtle)] text-[var(--sentiment-neu)] border-[var(--sentiment-neu-border)]'
                      }`}
                    >
                      {summaryData.dominant_sentiment}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[var(--accent-gold-text)] font-semibold">
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ringkasan Situasi Publik</span>
                  </div>
                  <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">
                    {summaryData.executive_overview}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-2xl bg-[var(--sentiment-pos-subtle)] border border-[var(--sentiment-pos-border)] space-y-2">
                    <div className="flex items-center gap-1.5 text-[var(--sentiment-pos)] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Sorotan Positif Utama</span>
                    </div>
                    <ul className="space-y-1.5 text-[var(--text-primary)]">
                      {summaryData.key_positive_themes && summaryData.key_positive_themes.length > 0 ? (
                        summaryData.key_positive_themes.map((theme, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[var(--sentiment-pos)] mt-0.5">&bull;</span>
                            <span>{theme}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-[var(--text-muted)] italic">Tidak ada tema positif menonjol.</li>
                      )}
                    </ul>
                  </div>

                  <div className="p-4 rounded-2xl bg-[var(--sentiment-neg-subtle)] border border-[var(--sentiment-neg-border)] space-y-2">
                    <div className="flex items-center gap-1.5 text-[var(--sentiment-neg)] font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Kekhawatiran &amp; Isu Kritis</span>
                    </div>
                    <ul className="space-y-1.5 text-[var(--text-primary)]">
                      {summaryData.key_critical_themes && summaryData.key_critical_themes.length > 0 ? (
                        summaryData.key_critical_themes.map((theme, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[var(--sentiment-neg)] mt-0.5">&bull;</span>
                            <span>{theme}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-[var(--text-muted)] italic">Tidak ada isu kritis menonjol.</li>
                      )}
                    </ul>
                  </div>
                </div>

                {summaryData.strategic_recommendations &&
                  summaryData.strategic_recommendations.length > 0 && (
                    <div className="surface-inset p-4 space-y-2">
                      <div className="font-semibold text-[var(--text-primary)]">
                        Rekomendasi Respons Komunikasi
                      </div>
                      <ul className="space-y-1.5 text-[var(--text-secondary)]">
                        {summaryData.strategic_recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-[var(--accent-gold-text)] mt-0.5">&bull;</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs">
              <span className="text-[var(--text-muted)] font-mono-code font-tabular">
                {summaryData?.cached_at
                  ? `Diperbarui: ${new Date(summaryData.cached_at).toLocaleTimeString('id-ID')}`
                  : ''}
              </span>
              <button
                type="button"
                onClick={() => setSummaryTopic(null)}
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
