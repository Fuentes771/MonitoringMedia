import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, HotIssuesRadarData, HotIssueItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  Flame,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Plus,
  X,
  CheckCircle2,
  Activity,
  MessageSquareText,
  Archive,
  ArrowRight,
  RefreshCw,
  Heart,
  FileText,
  Radio,
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
  const { chartTokens } = useTheme();
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

  const scanHotIssuesMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/hot-issues/scan', { workspace_id: workspaceId });
      return res.data;
    },
    onSuccess: (data: { message?: string }) => {
      void queryClient.invalidateQueries({ queryKey: ['hot-issues-radar'] });
      setScanMessage(data.message || 'Pemindaian berita Google News selesai.');
      setTimeout(() => setScanMessage(null), 6000);
    },
    onError: () => {
      setScanMessage('Gagal memindai berita. Silakan coba kembali.');
      setTimeout(() => setScanMessage(null), 6000);
    },
  });

  const archiveHotIssueMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/hot-issues/${id}`);
      return res.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['hot-issues-radar'] });
    },
  });

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
      void queryClient.invalidateQueries({ queryKey: ['hot-issues-radar'] });
      void queryClient.invalidateQueries({ queryKey: ['alerts-data'] });
      void queryClient.invalidateQueries({ queryKey: ['topics-list'] });
      void queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      setIsModalOpen(false);
      setName('');
      setDescription('');
      setKeywords('');
    },
  });

  const hotIssues = radarResponse?.hot_issues || [];
  const isSurging = radarResponse?.system_state === 'surging_detected';

  return (
    <div className="space-y-6 font-sans-ui animate-surface-enter">
      {/* Clean Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--text-primary)] tracking-tight">
              Radar Isu Hangat
            </h1>
            {isSurging && (
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)]">
                Lonjakan Terdeteksi
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl">
            Deteksi anomali lonjakan percakapan publik di luar 17 program prioritas ({radarResponse?.window_label || 'Jendela 33 Jam Terkini'}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => scanHotIssuesMutation.mutate()}
            disabled={scanHotIssuesMutation.isPending}
            className="btn-gold flex-1 md:flex-none min-h-11 px-4 text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${scanHotIssuesMutation.isPending ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{scanHotIssuesMutation.isPending ? 'Memindai...' : 'Pindai Isu Terkini'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="btn-contrast flex-1 md:flex-none min-h-11 px-4 text-xs inline-flex items-center justify-center gap-2"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Pantau Manual</span>
          </button>
        </div>
      </div>

      {/* Auto Discovery Notice */}
      {radarResponse?.auto_discovered && radarResponse?.auto_discovery_message && (
        <div className="p-3.5 rounded-2xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[var(--text-primary)] text-xs flex items-center gap-2.5">
          <Radio className="w-4 h-4 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
          <span className="font-medium">
            Pemindaian Otomatis Google News: {radarResponse.auto_discovery_message}
          </span>
        </div>
      )}

      {/* Scan Toast */}
      {scanMessage && (
        <div
          role="status"
          aria-live="polite"
          className="p-3.5 rounded-2xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] text-[var(--text-primary)] text-xs flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
            <span className="font-medium">{scanMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setScanMessage(null)}
            aria-label="Tutup notifikasi pemindaian"
            className="min-w-9 min-h-9 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* System Status Banner */}
      {isSurging ? (
        <div className="surface-card p-4 sm:p-5 border-[var(--sentiment-neg-border)] bg-[var(--sentiment-neg-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--bg-surface)] border border-[var(--sentiment-neg-border)] text-[var(--sentiment-neg)] flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
            <div>
              <div className="font-semibold text-[var(--sentiment-neg)]">
                Anomali Ruang Publik Terdeteksi ({radarResponse?.surging_count} isu melonjak)
              </div>
              <p className="text-[var(--text-secondary)] mt-0.5">
                Percakapan melampaui ambang batas normal pada jendela pemantauan 33 jam terakhir.
              </p>
            </div>
          </div>
          {radarResponse?.window_label && (
            <span className="text-[11px] font-mono-code text-[var(--text-muted)] shrink-0">
              {radarResponse.window_label}
            </span>
          )}
        </div>
      ) : (
        <div className="surface-card p-4 sm:p-5 border-[var(--sentiment-pos-border)] bg-[var(--sentiment-pos-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start sm:items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--sentiment-pos)] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
            <div>
              <div className="font-semibold text-[var(--sentiment-pos)]">
                Kondisi Percakapan Publik Stabil &amp; Kondusif
              </div>
              <p className="text-[var(--text-secondary)] mt-0.5">
                Tidak ada anomali lonjakan isu baru di luar ambang batas normal saat ini.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-[var(--text-muted)] shrink-0">Status normal</span>
        </div>
      )}

      {/* Hot Issues List */}
      <div className="space-y-5">
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label="Memuat isu hangat">
            {[1, 2].map((i) => (
              <div key={i} className="h-72 surface-card animate-pulse" />
            ))}
          </div>
        ) : hotIssues.length === 0 ? (
          <div className="surface-card p-10 sm:p-12 text-center space-y-4">
            <Flame className="w-8 h-8 text-[var(--text-muted)] mx-auto" aria-hidden="true" />
            <div className="space-y-1.5">
              <h2 className="font-editorial text-xl text-[var(--text-primary)] font-medium">
                Belum Ada Isu Hangat Aktif
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-md mx-auto">
                Jalankan pemindaian Google News untuk mendeteksi lonjakan terbaru secara otomatis, atau daftarkan isu secara manual.
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => scanHotIssuesMutation.mutate()}
                disabled={scanHotIssuesMutation.isPending}
                className="btn-gold min-h-11 px-5 text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 shrink-0 ${scanHotIssuesMutation.isPending ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{scanHotIssuesMutation.isPending ? 'Memindai...' : 'Pindai Berita Terhangat'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="btn-ghost-surface min-h-11 px-4 text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Tambah Manual</span>
              </button>
            </div>
          </div>
        ) : (
          hotIssues.map((issue: HotIssueItem) => {
            const isCritical = issue.urgency_level === 'critical';
            const curveColor = isCritical ? chartTokens.negStroke : chartTokens.goldStroke;

            return (
              <article key={issue.id} className="surface-card p-5 sm:p-6 space-y-5">
                {/* Top Ribbon */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 border ${
                        isCritical
                          ? 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                          : 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{isCritical ? 'Urgensi Kritis' : 'Urgensi Tinggi'}</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold font-tabular inline-flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
                      <span>{issue.surge_multiplier}x Lonjakan</span>
                    </span>

                    <span className="text-xs text-[var(--text-muted)] inline-flex items-center gap-1 font-tabular">
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>33 Jam</span>
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs text-[var(--text-secondary)] font-tabular mr-1">
                      Sebutan: <strong className="text-[var(--text-primary)]">{issue.total_mentions_33h}</strong>
                    </span>

                    {onNavigateToMentions && (
                      <button
                        type="button"
                        onClick={() => onNavigateToMentions(issue.id)}
                        className="btn-ghost-surface min-h-9 px-3 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <span>Bedah Sebutan</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-gold-text)]" aria-hidden="true" />
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
                        className="min-h-9 px-3 rounded-xl bg-[var(--accent-gold-subtle)] hover:opacity-90 border border-[var(--accent-gold-border)] text-xs font-semibold text-[var(--accent-gold-text)] inline-flex items-center gap-1.5 transition-opacity"
                      >
                        <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
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
                      className="min-h-9 px-2.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--sentiment-neg)] hover:bg-[var(--sentiment-neg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--sentiment-neg-border)] inline-flex items-center gap-1 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Arsipkan</span>
                    </button>
                  </div>
                </div>

                {/* Title & Context */}
                <div className="space-y-1">
                  <h2 className="font-editorial text-xl sm:text-2xl font-medium text-[var(--text-primary)] leading-snug">
                    {issue.title}
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    {issue.description}
                  </p>
                </div>

                {/* Sentiment & Acceleration Curve */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="surface-inset p-4 space-y-3">
                    <span className="text-xs font-semibold text-[var(--text-primary)] block">
                      Polaritas Sentimen Publik
                    </span>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-tabular">
                      <span className="text-[var(--sentiment-pos)] font-semibold">
                        Positif {issue.sentiment.pos_percent}%
                      </span>
                      <span className="text-[var(--text-secondary)] font-semibold">
                        Netral {issue.sentiment.neu_percent}%
                      </span>
                      <span className="text-[var(--sentiment-neg)] font-semibold">
                        Negatif {issue.sentiment.neg_percent}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-[var(--bg-surface)] gap-0.5">
                      <div style={{ width: `${issue.sentiment.pos_percent}%` }} className="bg-[var(--sentiment-pos-bar)] h-full" />
                      <div style={{ width: `${issue.sentiment.neu_percent}%` }} className="bg-[var(--sentiment-neu-bar)] h-full" />
                      <div style={{ width: `${issue.sentiment.neg_percent}%` }} className="bg-[var(--sentiment-neg-bar)] h-full" />
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                      Distribusi sentimen terhitung dari seluruh dokumen dalam jendela 33 jam terakhir.
                    </p>
                  </div>

                  <div className="lg:col-span-2 surface-inset p-4 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
                        <span>Kurva Akselerasi Sebutan (Per 3 Jam)</span>
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)]">Jendela 33 jam</span>
                    </div>

                    <div className="h-24 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={issue.hourly_velocity} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`colorSurge-${issue.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={curveColor} stopOpacity={0.35} />
                              <stop offset="95%" stopColor={curveColor} stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time_label" hide />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: chartTokens.tooltipBg,
                              borderColor: chartTokens.tooltipBorder,
                              borderRadius: '12px',
                              fontSize: '12px',
                              color: chartTokens.tooltipText,
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="count"
                            stroke={curveColor}
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

                {/* AI Synthesis */}
                {issue.ai_synthesis && (
                  <div className="p-4 rounded-2xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] space-y-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-gold-text)]">
                      <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>Ringkasan Risiko &amp; Dinamika Publik</span>
                    </div>
                    <p className="text-xs sm:text-[13px] text-[var(--text-primary)] leading-relaxed">
                      {issue.ai_synthesis}
                    </p>
                  </div>
                )}

                {/* Netizen Voices */}
                <div className="space-y-3 pt-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-semibold text-[var(--text-primary)] inline-flex items-center gap-1.5">
                      <MessageSquareText className="w-3.5 h-3.5 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
                      <span>Suara Netizen &amp; Bukti Lintas Kanal</span>
                    </span>
                    <span className="text-[var(--text-muted)] text-[11px]">Urut berdasarkan resonansi</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {issue.netizen_quotes.map((q) => (
                      <div key={q.id} className="pill-row p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="flex items-center flex-wrap gap-2 min-w-0">
                            <PlatformBadge provider={q.platform} size="xs" compactLabel isComment={q.is_comment} />
                            <span className="font-semibold text-[var(--text-primary)] truncate max-w-[140px]">
                              {q.author}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 font-tabular">
                            {q.metrics_available !== false && q.likes !== null && q.likes > 0 && (
                              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)]">
                                <Heart className="w-3 h-3 text-[var(--sentiment-neg)]" aria-hidden="true" />
                                <span>{q.likes.toLocaleString('id-ID')}</span>
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                q.sentiment === 'positive'
                                  ? 'bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border-[var(--sentiment-pos-border)]'
                                  : q.sentiment === 'negative'
                                    ? 'bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border-[var(--sentiment-neg-border)]'
                                    : 'bg-[var(--sentiment-neu-subtle)] text-[var(--sentiment-neu)] border-[var(--sentiment-neu-border)]'
                              }`}
                            >
                              {q.sentiment === 'positive'
                                ? 'Positif'
                                : q.sentiment === 'negative'
                                  ? 'Negatif'
                                  : 'Netral'}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs sm:text-[13px] text-[var(--text-primary)] leading-relaxed line-clamp-3">
                          &ldquo;{q.text}&rdquo;
                        </p>

                        <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                          <span className="font-mono-code font-tabular">{q.time_label}</span>
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
              </article>
            );
          })
        )}
      </div>

      {/* Modal: Tambah Pantauan Isu Hangat Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg-backdrop)] backdrop-blur-xs p-0 sm:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Pantau Isu Hangat Baru"
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-y-contain rounded-t-3xl sm:rounded-3xl border border-[var(--border-medium)] bg-[var(--bg-surface)] p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] space-y-5 shadow-[var(--shadow-elevated)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
                  Pantau Isu Hangat Baru
                </h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Daftarkan wacana viral atau krisis komunikasi untuk dipantau intensif
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                aria-label="Tutup jendela pantau isu"
                className="min-w-11 min-h-11 -mr-1.5 flex items-center justify-center rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition-colors shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="hot-issue-name" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Judul Isu Hangat *
                </label>
                <input
                  id="hot-issue-name"
                  type="text"
                  placeholder="misal: Dugaan Kebocoran Data Publik"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full min-h-11 px-3.5 py-2.5 text-base sm:text-xs"
                />
              </div>

              <div>
                <label htmlFor="hot-issue-desc" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Deskripsi / Konteks Isu
                </label>
                <textarea
                  id="hot-issue-desc"
                  rows={2}
                  placeholder="Konteks singkat mengenai latar belakang isu yang sedang berkembang..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field w-full px-3.5 py-2.5 text-base sm:text-xs resize-none"
                />
              </div>

              <div>
                <label htmlFor="hot-issue-keywords" className="block text-[var(--text-primary)] font-semibold mb-1.5">
                  Kata Kunci Pemantauan (pisahkan dengan koma) *
                </label>
                <input
                  id="hot-issue-keywords"
                  type="text"
                  placeholder="misal: kebocoran data, audit keamanan, privasi"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  className="input-field w-full min-h-11 px-3.5 py-2.5 text-base sm:text-xs"
                />
              </div>

              <fieldset>
                <legend className="block text-[var(--text-primary)] font-semibold mb-2">
                  Tingkat Urgensi
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label className="min-h-11 flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'critical'}
                      onChange={() => setUrgencyLevel('critical')}
                      className="accent-[var(--sentiment-neg-bar)]"
                    />
                    <span className="text-[var(--sentiment-neg)] font-semibold">Kritis</span>
                  </label>
                  <label className="min-h-11 flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'elevated'}
                      onChange={() => setUrgencyLevel('elevated')}
                      className="accent-[var(--accent-gold)]"
                    />
                    <span className="text-[var(--accent-gold-text)] font-semibold">Tinggi</span>
                  </label>
                  <label className="min-h-11 flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgencyLevel === 'normal'}
                      onChange={() => setUrgencyLevel('normal')}
                      className="accent-[var(--accent-gold)]"
                    />
                    <span className="text-[var(--text-primary)] font-semibold">Normal</span>
                  </label>
                </div>
              </fieldset>
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
                disabled={!name.trim() || createHotIssueMutation.isPending}
                onClick={() => createHotIssueMutation.mutate()}
                className="btn-gold min-h-11 px-5 disabled:opacity-50"
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
