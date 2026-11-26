import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  api,
  BuzzerRadarOverview,
  TopicItem,
  CopypastaCluster,
  SarcasmHighlight,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  ShieldCheck,
  Bot,
  Copy,
  RefreshCw,
  AlertTriangle,
  Users,
  MessageSquareWarning,
  CheckCircle2,
  Activity,
  ArrowRight,
  MessageSquareText,
} from 'lucide-react';
import { PlatformBadge } from '@/components/common/PlatformBadge';
import { LinkVerificationBadge } from '@/components/common/LinkVerificationBadge';

interface BuzzerRadarPageProps {
  days: number;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
  onNavigateToMentionsWithFilters?: (
    topicId?: number,
    sentiment?: string,
    keyword?: string,
    extra?: { authorName?: string; botClusterId?: string; onlyInauthentic?: boolean }
  ) => void;
}

export function BuzzerRadarPage({
  days,
  onOpenAiWithQuery,
  onNavigateToMentionsWithFilters,
}: BuzzerRadarPageProps) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuth();
  const { chartTokens } = useTheme();
  const workspaceId = activeWorkspace?.id;
  const [selectedTopicId, setSelectedTopicId] = useState<number | undefined>(undefined);
  const [scanBanner, setScanBanner] = useState<string | null>(null);

  const { data: topics } = useQuery({
    queryKey: ['topics-list', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ data: TopicItem[] }>(`/workspaces/${workspaceId}/topics`);
      return res.data.data;
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['buzzer-radar-overview', workspaceId, days, selectedTopicId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ data: BuzzerRadarOverview }>('/buzzer-radar/overview', {
        params: { workspace_id: workspaceId, days, topic_id: selectedTopicId },
      });
      return res.data.data;
    },
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ message: string; data: BuzzerRadarOverview }>(
        '/buzzer-radar/scan',
        { workspace_id: workspaceId, days, topic_id: selectedTopicId }
      );
      return res.data;
    },
    onSuccess: (resData) => {
      setScanBanner(resData.message);
      queryClient.setQueryData(
        ['buzzer-radar-overview', workspaceId, days, selectedTopicId],
        resData.data
      );
      void queryClient.invalidateQueries({ queryKey: ['mentions-explorer'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
    },
  });

  const authIndex = data?.authenticity_index;
  const clusters = data?.copypasta_clusters || [];
  const timeline = data?.burst_timeline || [];
  const sarcasmList = data?.sarcasm_highlights || [];
  const suspectedAccounts = data?.suspected_accounts || [];

  const getThreatBadge = (level?: string) => {
    switch (level) {
      case 'HIGH_ASTROTURFING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)]">
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Astroturfing Tinggi</span>
          </span>
        );
      case 'ELEVATED_PROPAGANDA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border border-[var(--accent-gold-border)]">
            <Activity className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Amplifikasi Meningkat</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border border-[var(--sentiment-pos-border)]">
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Organik Dominan</span>
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" role="status" aria-label="Memuat radar buzzer">
        <div className="h-24 surface-card animate-pulse" />
        <div className="h-32 surface-card animate-pulse" />
        <div className="h-72 surface-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans-ui animate-surface-enter">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[var(--border-subtle)]">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-editorial text-2xl sm:text-3xl font-medium text-[var(--text-primary)] tracking-tight">
              Radar Buzzer, Bot &amp; Sarkasme
            </h1>
            {getThreatBadge(authIndex?.threat_level)}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl">
            Pemetaan perilaku inautentik terkoordinasi, klaster copypasta, dan pembedahan komentar satir netizen.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto shrink-0">
          <select
            aria-label="Filter topik radar buzzer"
            value={selectedTopicId || ''}
            onChange={(e) => setSelectedTopicId(e.target.value ? Number(e.target.value) : undefined)}
            className="input-field w-full sm:w-auto min-h-11 px-3.5 py-2 text-sm sm:text-xs"
          >
            <option value="">Semua Topik &amp; Isu Nasional</option>
            {topics?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending || isFetching}
            className="btn-gold min-h-11 px-4 text-xs inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 shrink-0 ${scanMutation.isPending ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{scanMutation.isPending ? 'Memindai...' : 'Pindai Jaringan & Sarkasme'}</span>
          </button>
        </div>
      </div>

      {/* Scan Notice */}
      {scanBanner && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-[var(--sentiment-pos-subtle)] border border-[var(--sentiment-pos-border)] flex items-center justify-between gap-3 text-xs text-[var(--sentiment-pos)] font-medium"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{scanBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setScanBanner(null)}
            className="min-h-9 px-2.5 rounded-lg text-xs font-semibold hover:bg-[var(--bg-surface)]"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Unified Ref-1 Style 4-KPI Authenticity Dock */}
      <div className="surface-card p-5 sm:p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Suara Organik</span>
              <ShieldCheck className="w-4 h-4 text-[var(--sentiment-pos)] shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] font-tabular">
                {authIndex?.organic_percent ?? 100}%
              </span>
              <span className="text-xs text-[var(--sentiment-pos)] font-semibold font-tabular">
                {authIndex?.organic_count ?? 0}/{authIndex?.total_mentions ?? 0}
              </span>
            </div>
            <div className="w-full h-1.5 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--sentiment-pos-bar)] rounded-full"
                style={{ width: `${Math.min(100, authIndex?.organic_percent ?? 100)}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Percakapan natural dan media terverifikasi</p>
          </div>

          <div className="space-y-2 min-w-0 lg:border-l lg:border-[var(--border-subtle)] lg:pl-5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Indikasi Buzzer / Bot</span>
              <Bot className="w-4 h-4 text-[var(--sentiment-neg)] shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-[var(--sentiment-neg)] font-tabular">
                {authIndex?.inauthentic_percent ?? 0}%
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-tabular">
                {authIndex?.inauthentic_count ?? 0} dok
              </span>
            </div>
            <div className="w-full h-1.5 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--sentiment-neg-bar)] rounded-full"
                style={{ width: `${Math.min(100, authIndex?.inauthentic_percent ?? 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Akun anomali atau duplikasi terkoordinasi</p>
          </div>

          <div className="space-y-2 min-w-0 lg:border-l lg:border-[var(--border-subtle)] lg:pl-5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Sarkasme &amp; Satir</span>
              <MessageSquareWarning className="w-4 h-4 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-[var(--accent-gold-text)] font-tabular">
                {authIndex?.sarcasm_percent ?? 0}%
              </span>
              <span className="text-xs text-[var(--text-secondary)] font-tabular">
                {authIndex?.sarcasm_count ?? 0} dikoreksi
              </span>
            </div>
            <div className="w-full h-1.5 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent-gold)] rounded-full"
                style={{ width: `${Math.min(100, authIndex?.sarcasm_percent ?? 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">Sindiran ironis otomatis dikoreksi ke Negatif</p>
          </div>

          <div className="space-y-2 min-w-0 lg:border-l lg:border-[var(--border-subtle)] lg:pl-5">
            <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="font-medium">Klaster Copypasta</span>
              <Copy className="w-4 h-4 text-[var(--text-secondary)] shrink-0" aria-hidden="true" />
            </div>
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] font-tabular">
                {authIndex?.clusters_count ?? 0}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-tabular">&ge;75% mirip</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] pt-2">
              Teks kampanye seragam lintas akun pada jendela berdekatan
            </p>
          </div>
        </div>
      </div>

      {/* Burst Attack & Sarcasm Timeline Chart */}
      <section aria-label="Kronologi suara organik dan anomali bot" className="surface-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
              Perbandingan Arus Organik, Indikasi Bot &amp; Sarkasme
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Pola lonjakan akun tidak autentik terhadap arus diskusi publik natural
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-medium shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[var(--sentiment-pos)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--sentiment-pos-bar)]" aria-hidden="true" />
              Organik
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--sentiment-neg)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--sentiment-neg-bar)]" aria-hidden="true" />
              Bot / Buzzer
            </span>
            <span className="inline-flex items-center gap-1.5 text-[var(--accent-gold-text)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-gold)]" aria-hidden="true" />
              Sarkasme
            </span>
          </div>
        </div>

        <div className="h-60 sm:h-68 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOrganic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTokens.posStroke} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={chartTokens.posStroke} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradBot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTokens.negStroke} stopOpacity={0.34} />
                  <stop offset="95%" stopColor={chartTokens.negStroke} stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="gradSarcasm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartTokens.goldStroke} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={chartTokens.goldStroke} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 4" stroke={chartTokens.gridStroke} />
              <XAxis
                dataKey="time_label"
                stroke={chartTokens.axisStroke}
                tick={{ fill: chartTokens.tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={22}
              />
              <YAxis
                stroke={chartTokens.axisStroke}
                tick={{ fill: chartTokens.tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: chartTokens.tooltipBg,
                  borderColor: chartTokens.tooltipBorder,
                  borderRadius: '14px',
                  fontSize: '12px',
                  color: chartTokens.tooltipText,
                }}
              />
              <Area type="monotone" dataKey="organic" name="Suara Organik" stroke={chartTokens.posStroke} fill="url(#gradOrganic)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="inauthentic" name="Indikasi Bot / Buzzer" stroke={chartTokens.negStroke} fill="url(#gradBot)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="sarcasm" name="Komentar Sarkasme" stroke={chartTokens.goldStroke} fill="url(#gradSarcasm)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 2-Column Deep Inspection: Copypasta Clusters & Sarcasm */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Copypasta Clusters */}
        <section aria-label="Klaster narasi copypasta" className="lg:col-span-6 surface-card p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
            <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
              Klaster Narasi Copypasta
            </h2>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface-elevated)] text-xs font-semibold font-tabular text-[var(--text-secondary)] shrink-0">
              {clusters.length} Klaster
            </span>
          </div>

          {clusters.length === 0 ? (
            <div className="surface-inset p-8 text-center space-y-2">
              <ShieldCheck className="w-7 h-7 text-[var(--sentiment-pos)] mx-auto" aria-hidden="true" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Tidak Ditemukan Serangan Copypasta Masif
              </div>
              <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                Percakapan pada rentang waktu ini memiliki variasi diksi natural tanpa duplikasi template beruntun.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[540px] overflow-y-auto overscroll-y-contain pr-1">
              {clusters.map((cluster: CopypastaCluster) => (
                <article key={cluster.cluster_id} className="pill-row p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)] font-semibold font-tabular text-[11px]">
                        {cluster.copy_count}x Duplikasi
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-tabular text-[11px]">
                        {cluster.unique_accounts_count} Akun
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono-code">
                        #{cluster.cluster_id}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--accent-gold-text)] bg-[var(--accent-gold-subtle)] px-2.5 py-0.5 rounded-lg">
                      {cluster.narrative_agenda}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] leading-relaxed break-words">
                    &ldquo;{cluster.canonical_text}&rdquo;
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1 text-[11px]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                      {cluster.accounts.slice(0, 4).map((acc, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-mono-code text-[10.5px]"
                        >
                          {acc}
                        </span>
                      ))}
                      {cluster.accounts.length > 4 && (
                        <span className="text-[10.5px] text-[var(--text-muted)]">
                          +{cluster.accounts.length - 4} lainnya
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {onNavigateToMentionsWithFilters && (
                        <button
                          type="button"
                          onClick={() =>
                            onNavigateToMentionsWithFilters(selectedTopicId, undefined, undefined, {
                              botClusterId: cluster.cluster_id,
                            })
                          }
                          className="min-h-9 inline-flex items-center gap-1 text-[var(--text-primary)] font-semibold rounded-lg px-2.5 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)]"
                        >
                          <span>Lihat {cluster.copy_count} Bukti</span>
                          <ArrowRight className="w-3 h-3 text-[var(--accent-gold-text)]" aria-hidden="true" />
                        </button>
                      )}

                      {onOpenAiWithQuery && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenAiWithQuery(
                              `Analisis motif dan agenda di balik kluster narasi copypasta ini (${cluster.copy_count} duplikasi dari ${cluster.unique_accounts_count} akun): "${cluster.canonical_text}". Apa tujuan penggiringan opininya?`
                            )
                          }
                          className="min-h-9 inline-flex items-center gap-1 text-[var(--accent-gold-text)] font-semibold rounded-lg px-2.5 bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)]"
                        >
                          <MessageSquareText className="w-3 h-3" aria-hidden="true" />
                          <span>Bedah AI</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Sarcasm Highlights */}
        <section aria-label="Pembedahan sarkasme dan satir" className="lg:col-span-6 surface-card p-5 sm:p-6 space-y-4 min-w-0">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
            <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
              Pembedahan Sarkasme &amp; Satir
            </h2>
            <span className="px-2.5 py-1 rounded-lg bg-[var(--accent-gold-subtle)] text-xs font-semibold font-tabular text-[var(--accent-gold-text)] shrink-0">
              {sarcasmList.length} Terdeteksi
            </span>
          </div>

          {sarcasmList.length === 0 ? (
            <div className="surface-inset p-8 text-center space-y-2">
              <MessageSquareWarning className="w-7 h-7 text-[var(--text-muted)] mx-auto" aria-hidden="true" />
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Belum Ada Komentar Sarkasme
              </div>
              <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                Komentar netizen bernada ironis akan otomatis muncul di sini dan polaritasnya dikoreksi ke Negatif.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[540px] overflow-y-auto overscroll-y-contain pr-1">
              {sarcasmList.map((item: SarcasmHighlight) => (
                <article key={item.id} className="pill-row p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <PlatformBadge provider={item.provider} size="xs" compactLabel />
                      <span className="font-semibold text-[var(--text-primary)] truncate max-w-[140px]">
                        {item.author_name}
                      </span>
                      <span className="text-[11px] text-[var(--text-muted)] font-mono-code">{item.time_label}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] text-[10.5px] font-semibold font-tabular">
                        Sarkasme {Math.round(item.sarcasm_score * 100)}%
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] text-[10.5px] font-semibold">
                        Negatif
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[var(--text-primary)] leading-relaxed bg-[var(--bg-surface)] p-3 rounded-xl border border-[var(--border-subtle)] break-words">
                    &ldquo;{item.text}&rdquo;
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                    <p className="text-[var(--text-secondary)] min-w-0">
                      <strong className="text-[var(--text-primary)]">Catatan Ironi:</strong> {item.sarcasm_reason}
                    </p>
                    <LinkVerificationBadge
                      provider={item.provider}
                      sourceUrl={item.source_url}
                      linkStatus={item.link_status}
                      compact
                      showActionLink
                      actionLabel="Sumber"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Suspected Bot Accounts Table / Cards */}
      <section aria-label="Daftar akun terindikasi bot" className="surface-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
              Akun Terindikasi Bot &amp; Buzzer Kampanye
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Berdasarkan anomali frekuensi unggahan dan keseragaman narasi
            </p>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-tabular">
            {suspectedAccounts.length} akun anomali
          </span>
        </div>

        {suspectedAccounts.length === 0 ? (
          <div className="surface-inset p-8 text-center text-xs text-[var(--text-muted)]">
            Belum ditemukan akun dengan pola anomali bot pada rentang waktu ini.
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {suspectedAccounts.map((acc, idx) => (
                <div key={idx} className="pill-row p-4 space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="font-mono-code font-bold text-[var(--text-primary)] text-sm truncate">
                        {acc.author_name}
                      </div>
                      <div className="flex items-center flex-wrap gap-2">
                        <PlatformBadge provider={acc.provider} size="xs" compactLabel />
                        <span className="text-[11px] text-[var(--text-secondary)] font-tabular">
                          {acc.post_count} dok
                        </span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)] font-bold font-tabular text-xs shrink-0">
                      Bot {Math.round(acc.avg_bot_score * 100)}%
                    </span>
                  </div>

                  {acc.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {acc.signals.map((sig, sIdx) => (
                        <span
                          key={sIdx}
                          className="px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10.5px] text-[var(--text-secondary)]"
                        >
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2 bg-[var(--bg-surface)] p-2.5 rounded-lg border border-[var(--border-subtle)]">
                    {acc.sample_text}
                  </p>

                  {onNavigateToMentionsWithFilters && (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigateToMentionsWithFilters(selectedTopicId, undefined, undefined, {
                          authorName: acc.author_name,
                          onlyInauthentic: true,
                        })
                      }
                      className="btn-ghost-surface w-full min-h-11 inline-flex items-center justify-center gap-1.5 px-3 text-xs font-semibold"
                    >
                      <span>Lihat {acc.post_count} Post Akun Ini</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--sentiment-neg)]" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)]">
                    <th className="py-3 px-3">Akun / Handle</th>
                    <th className="py-3 px-3">Platform</th>
                    <th className="py-3 px-3">Volume</th>
                    <th className="py-3 px-3">Skor Bot</th>
                    <th className="py-3 px-3">Sinyal Anomali</th>
                    <th className="py-3 px-3">Sampel Narasi</th>
                    {onNavigateToMentionsWithFilters && <th className="py-3 px-3 text-right">Aksi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {suspectedAccounts.map((acc, idx) => (
                    <tr key={idx} className="hover:bg-[var(--bg-surface-elevated)] transition-colors">
                      <td className="py-3.5 px-3 font-mono-code font-semibold text-[var(--text-primary)]">
                        {acc.author_name}
                      </td>
                      <td className="py-3.5 px-3">
                        <PlatformBadge provider={acc.provider} size="xs" compactLabel />
                      </td>
                      <td className="py-3.5 px-3 font-tabular text-[var(--text-secondary)]">
                        {acc.post_count} dok
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded-lg bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] border border-[var(--sentiment-neg-border)] font-bold font-tabular text-[11px]">
                          {Math.round(acc.avg_bot_score * 100)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex flex-wrap gap-1">
                          {acc.signals.map((sig, sIdx) => (
                            <span
                              key={sIdx}
                              className="px-2 py-0.5 rounded-md bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[10.5px] text-[var(--text-secondary)]"
                            >
                              {sig}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-[var(--text-secondary)] max-w-xs truncate">
                        {acc.sample_text}
                      </td>
                      {onNavigateToMentionsWithFilters && (
                        <td className="py-3.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToMentionsWithFilters(selectedTopicId, undefined, undefined, {
                                authorName: acc.author_name,
                                onlyInauthentic: true,
                              })
                            }
                            className="min-h-9 inline-flex items-center gap-1 px-3 rounded-lg bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-[11px] font-semibold whitespace-nowrap transition-colors"
                          >
                            <span>Lihat {acc.post_count} Post</span>
                            <ArrowRight className="w-3 h-3 text-[var(--sentiment-neg)]" aria-hidden="true" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
