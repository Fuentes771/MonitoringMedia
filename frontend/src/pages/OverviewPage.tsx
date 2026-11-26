import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, DashboardOverview, TimelinePoint, MentionItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ExecutiveBriefingCard } from '@/components/dashboard/ExecutiveBriefingCard';
import { TimeseriesChart } from '@/components/dashboard/TimeseriesChart';
import { SentimentDistribution } from '@/components/dashboard/SentimentDistribution';
import { PlatformBreakdown } from '@/components/dashboard/PlatformBreakdown';
import { RisingTopicsCard } from '@/components/dashboard/RisingTopicsCard';
import { TopKeywordsCard } from '@/components/dashboard/TopKeywordsCard';
import { LiveEvidenceRail } from '@/components/dashboard/LiveEvidenceRail';
import { MentionInspectorDrawer } from '@/components/mentions/MentionInspectorDrawer';
import { AlertCircle, RefreshCw, Flame, ShieldAlert, Layers } from 'lucide-react';

interface OverviewPageProps {
  days: number;
  organicOnly?: boolean;
  onNavigateToTopic: (topicId: number) => void;
  onNavigateToMentionsWithKeyword: (kw: string) => void;
  onOpenAiWithQuery?: (query: string, topicId?: number) => void;
}

type OperationalLens = 'all' | 'critical' | 'rising';

export function OverviewPage({
  days,
  organicOnly = false,
  onNavigateToTopic,
  onNavigateToMentionsWithKeyword,
  onOpenAiWithQuery,
}: OverviewPageProps) {
  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;
  const [activeLens, setActiveLens] = useState<OperationalLens>('all');
  const [selectedMention, setSelectedMention] = useState<MentionItem | null>(null);

  // 1. Overview KPIs & Daily Briefing
  const {
    data: overview,
    isLoading: isOverviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['dashboard-overview', workspaceId, days, organicOnly],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<DashboardOverview>('/dashboard/overview', {
        params: { workspace_id: workspaceId, days, exclude_inauthentic: organicOnly || undefined },
      });
      return res.data;
    },
  });

  // 2. Timeseries
  const { data: timeseriesData, isLoading: isTimeseriesLoading } = useQuery({
    queryKey: ['dashboard-timeseries', workspaceId, days, organicOnly],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ timeline: TimelinePoint[] }>('/dashboard/timeseries', {
        params: { workspace_id: workspaceId, days, exclude_inauthentic: organicOnly || undefined },
      });
      return res.data;
    },
  });

  // 3. Trends & Keywords
  const { data: trendsData, isLoading: isTrendsLoading } = useQuery({
    queryKey: ['trends', workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get('/trends', {
        params: { workspace_id: workspaceId },
      });
      return res.data.data;
    },
  });

  // 4. Recent Mentions
  const { data: recentMentions, isLoading: isMentionsLoading } = useQuery({
    queryKey: ['recent-mentions', workspaceId, organicOnly],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<{ data: MentionItem[] }>('/mentions', {
        params: {
          workspace_id: workspaceId,
          per_page: 10,
          exclude_inauthentic: organicOnly || undefined,
          skip_meta_counts: 1,
        },
      });
      return res.data.data;
    },
  });

  if (isOverviewLoading) {
    return (
      <div className="space-y-6" role="status" aria-busy="true" aria-label="Memuat ringkasan intelijen">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 h-80 surface-card animate-pulse" />
          <div className="lg:col-span-5 h-80 surface-card animate-pulse" />
        </div>
        <div className="h-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-8 space-y-5">
            <div className="h-84 surface-card animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              <div className="md:col-span-7 h-72 surface-card animate-pulse" />
              <div className="md:col-span-5 h-72 surface-card animate-pulse" />
            </div>
          </div>
          <div className="xl:col-span-4 space-y-5">
            <div className="h-[520px] surface-card animate-pulse" />
            <div className="h-52 surface-card animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div
        role="alert"
        className="surface-card p-8 text-center max-w-lg mx-auto my-12 space-y-4 border-[var(--sentiment-neg-border)]"
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--sentiment-neg-subtle)] text-[var(--sentiment-neg)] flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-editorial text-xl font-medium text-[var(--text-primary)]">
            Ringkasan Analitik Tidak Dapat Dimuat
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Koneksi ke server data terputus atau belum merespons. Pastikan layanan API backend aktif lalu muat ulang data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetchOverview()}
          className="btn-contrast min-h-11 px-5 text-xs inline-flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Muat Ulang Data</span>
        </button>
      </div>
    );
  }

  const allTopics = trendsData?.rising_topics || [];
  const filteredTopics =
    activeLens === 'critical'
      ? allTopics.filter((t: { trend_score?: number }) => (t.trend_score || 0) > 70)
      : allTopics;

  const rawMentions = recentMentions || [];
  const displayMentions =
    activeLens === 'critical'
      ? rawMentions.filter((m) => m.sentiment?.label === 'negative')
      : rawMentions;

  const lensItems: Array<{
    id: OperationalLens;
    label: string;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'all', label: 'Semua Isu', shortLabel: 'Semua', icon: Layers },
    { id: 'rising', label: 'Tren Akselerasi', shortLabel: 'Akselerasi', icon: Flame },
    { id: 'critical', label: 'Fokus Kritis', shortLabel: 'Kritis', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6 animate-surface-enter">
      {/* 1. Split Executive Hero & Factual Chronology */}
      <ExecutiveBriefingCard
        totalMentions={overview.kpis.total_mentions}
        changePercent={overview.kpis.mentions_change_percent}
        negativeSharePercent={overview.kpis.negative_share_percent}
        risingTopicsCount={overview.kpis.rising_topics_count}
        positiveCount={overview.sentiment.positive}
        neutralCount={overview.sentiment.neutral}
        negativeCount={overview.sentiment.negative}
        dailyBriefing={overview.daily_briefing}
        onSelectEventMention={(eventId) => {
          const found = rawMentions.find((m) => m.id === eventId);
          if (found) {
            setSelectedMention(found);
          } else {
            const ev = overview.daily_briefing?.chronological_events?.find((e) => e.id === eventId);
            if (ev) {
              onOpenAiWithQuery?.(`Analisis peristiwa: "${ev.headline}" pada program ${ev.program_name}`);
            }
          }
        }}
        onAskAi={(query, topicId) => onOpenAiWithQuery?.(query, topicId)}
      />

      {/* 2. Operational Lens Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div
          role="group"
          aria-label="Filter lensa analitik"
          className="inline-flex items-center p-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full sm:w-auto"
        >
          {lensItems.map((lens) => {
            const Icon = lens.icon;
            const active = activeLens === lens.id;
            const isCrit = lens.id === 'critical';
            return (
              <button
                key={lens.id}
                type="button"
                onClick={() => setActiveLens(lens.id)}
                aria-pressed={active}
                className={`min-h-10 sm:min-h-9 flex-1 sm:flex-none px-3.5 sm:px-4 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  active
                    ? isCrit
                      ? 'bg-[var(--sentiment-neg-bar)] text-white'
                      : 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">{lens.shortLabel}</span>
                <span className="hidden sm:inline">{lens.label}</span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-[var(--text-muted)] font-tabular">
          Menampilkan <span className="font-semibold text-[var(--text-primary)]">{overview.kpis.total_mentions.toLocaleString('id-ID')}</span> sebutan terindeks dalam rentang {days === 1 ? '24 jam' : `${days} hari`} terakhir
        </p>
      </div>

      {/* 3. Asymmetric Analytical Workspace (8:4 on xl, 2-col tablet, 1-col phone) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left Main Stage */}
        <div className="xl:col-span-8 space-y-5 sm:space-y-6 min-w-0">
          {isTimeseriesLoading ? (
            <div className="h-84 surface-card animate-pulse" aria-busy="true" />
          ) : (
            <TimeseriesChart timeline={timeseriesData?.timeline || []} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6 items-start">
            <div className="md:col-span-7 min-w-0">
              {isTrendsLoading ? (
                <div className="h-72 surface-card animate-pulse" aria-busy="true" />
              ) : (
                <RisingTopicsCard
                  topics={filteredTopics}
                  onSelectTopic={onNavigateToTopic}
                />
              )}
            </div>
            <div className="md:col-span-5 min-w-0">
              {isTrendsLoading ? (
                <div className="h-72 surface-card animate-pulse" aria-busy="true" />
              ) : (
                <TopKeywordsCard
                  keywords={trendsData?.top_keywords || []}
                  onSelectKeyword={onNavigateToMentionsWithKeyword}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Tactical Rail */}
        <div className="xl:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-5 sm:gap-6 min-w-0">
          <div className="md:col-span-2 xl:col-span-1 min-w-0">
            <LiveEvidenceRail
              mentions={displayMentions}
              isLoading={isMentionsLoading}
              onSelectMention={(mention) => setSelectedMention(mention)}
              onViewAllMentions={() => onNavigateToMentionsWithKeyword('')}
              onAskAi={(query) => onOpenAiWithQuery?.(query)}
            />
          </div>

          <div className="min-w-0">
            <SentimentDistribution
              positive={overview.sentiment.positive}
              neutral={overview.sentiment.neutral}
              negative={overview.sentiment.negative}
              unknown={overview.sentiment.unknown}
            />
          </div>

          <div className="min-w-0">
            <PlatformBreakdown platforms={overview.platform_breakdown} />
          </div>
        </div>
      </div>

      {/* Deep-dive Mention Inspector Drawer */}
      <MentionInspectorDrawer
        mention={selectedMention}
        onClose={() => setSelectedMention(null)}
        onAskAi={(mention) => {
          setSelectedMention(null);
          const topicId = mention.topics && mention.topics.length > 0 ? mention.topics[0].id : undefined;
          onOpenAiWithQuery?.(
            `Analisis mendalam sebutan berita ini: "${mention.text}" (Sumber: ${mention.author_name || mention.provider}, Sentimen: ${mention.sentiment?.label || 'Netral'})`,
            topicId
          );
        }}
      />
    </div>
  );
}
