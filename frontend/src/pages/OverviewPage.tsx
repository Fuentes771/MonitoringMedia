import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, DashboardOverview, TimelinePoint, MentionItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ExecutiveBriefingCard } from '@/components/dashboard/ExecutiveBriefingCard';
import { BreakingDispatchMarquee } from '@/components/dashboard/BreakingDispatchMarquee';
import { TimeseriesChart } from '@/components/dashboard/TimeseriesChart';
import { SentimentDistribution } from '@/components/dashboard/SentimentDistribution';
import { PlatformBreakdown } from '@/components/dashboard/PlatformBreakdown';
import { RisingTopicsCard } from '@/components/dashboard/RisingTopicsCard';
import { TopKeywordsCard } from '@/components/dashboard/TopKeywordsCard';
import { LiveEvidenceRail } from '@/components/dashboard/LiveEvidenceRail';
import { MentionInspectorDrawer } from '@/components/mentions/MentionInspectorDrawer';
import { AlertCircle, RefreshCw, Filter, Flame, ShieldAlert, Layers } from 'lucide-react';

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

  // 1. Fetch Overview KPIs
  const { data: overview, isLoading: isOverviewLoading, error: overviewError, refetch: refetchOverview } = useQuery({
    queryKey: ['dashboard-overview', workspaceId, days, organicOnly],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<DashboardOverview>('/dashboard/overview', {
        params: { workspace_id: workspaceId, days, exclude_inauthentic: organicOnly || undefined },
      });
      return res.data;
    },
  });

  // 2. Fetch Timeseries
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

  // 3. Fetch Trends
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

  // 4. Fetch Recent Mentions (lightweight: skip expensive near-duplicate count)
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
      <div className="space-y-6">
        {/* Marquee skeleton */}
        <div className="h-10 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse" />

        {/* Hero Briefing Card skeleton */}
        <div className="h-64 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
        
        {/* Scope bar skeleton */}
        <div className="h-12 bg-white/[0.02] border border-white/[0.06] rounded-xl animate-pulse" />

        {/* 8:4 Grid skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-6">
            <div className="h-84 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 h-64 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
              <div className="lg:col-span-5 h-64 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
            </div>
          </div>
          <div className="xl:col-span-4 space-y-6">
            <div className="h-[520px] bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
            <div className="h-56 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="p-8 text-center border border-rose-500/20 rounded-2xl bg-rose-500/5 text-rose-300 max-w-lg mx-auto my-12">
        <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="font-semibold text-base text-white mb-1 font-sans-ui">Gagal Memuat Ringkasan Analitik</h3>
        <p className="text-xs text-zinc-400 mb-4 font-sans-ui">
          Terjadi kendala saat menghubungkan ke server data. Pastikan backend server aktif dan database terhubung.
        </p>
        <button
          onClick={() => refetchOverview()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Coba Muat Ulang</span>
        </button>
      </div>
    );
  }

  // Filter topics based on active operational lens
  const allTopics = trendsData?.rising_topics || [];
  const filteredTopics = activeLens === 'critical'
    ? allTopics.filter((t: any) => (t.trend_score || 0) > 70)
    : allTopics;

  // Filter mentions based on active lens
  const rawMentions = recentMentions || [];
  const displayMentions = activeLens === 'critical'
    ? rawMentions.filter((m) => m.sentiment?.label === 'negative')
    : rawMentions;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Breaking Dispatch Marquee (Live Feed Ticker) */}
      <BreakingDispatchMarquee
        mentions={rawMentions}
        onSelectMention={(m) => setSelectedMention(m)}
        onAskAi={(query) => onOpenAiWithQuery?.(query)}
      />

      {/* 2. Master Executive Briefing Card (Editorial Bento Anchor) */}
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

      {/* 3. Interactive Operational Lens & Status Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-3 p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl text-xs">
        {/* Left: Operational Lenses (Clean 3-col fit on phone, inline wrap on sm+) */}
        <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full md:w-auto">
          <span className="hidden sm:flex text-zinc-400 font-medium mr-1.5 items-center gap-1.5 font-sans-ui shrink-0">
            <Filter className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span>Lensa Analitik:</span>
          </span>
          <button
            type="button"
            onClick={() => setActiveLens('all')}
            aria-pressed={activeLens === 'all'}
            className={`min-h-11 sm:min-h-9 px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 font-sans-ui ${
              activeLens === 'all'
                ? 'bg-white text-zinc-950 font-bold shadow-xs'
                : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="sm:hidden truncate">Semua</span>
            <span className="hidden sm:inline">Semua Isu</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLens('rising')}
            aria-pressed={activeLens === 'rising'}
            className={`min-h-11 sm:min-h-9 px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 font-sans-ui ${
              activeLens === 'rising'
                ? 'bg-white text-zinc-950 font-bold shadow-xs'
                : 'text-zinc-300 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="sm:hidden truncate">Akselerasi</span>
            <span className="hidden sm:inline">Tren Akselerasi</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveLens('critical')}
            aria-pressed={activeLens === 'critical'}
            className={`min-h-11 sm:min-h-9 px-2 sm:px-3 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 font-sans-ui ${
              activeLens === 'critical'
                ? 'bg-rose-500 text-white font-bold shadow-xs'
                : 'text-zinc-300 hover:text-rose-400 hover:bg-white/[0.04]'
            }`}
          >
            <ShieldAlert className={`w-3.5 h-3.5 shrink-0 ${activeLens === 'critical' ? 'text-white' : 'text-rose-400'}`} aria-hidden="true" />
            <span className="sm:hidden truncate">Kritis</span>
            <span className="hidden sm:inline">Fokus Kritis</span>
          </button>
        </div>

        {/* Right: Realtime Ingestion Pulse */}
        <div className="flex items-center gap-2 text-zinc-400 text-[11px] font-mono-code shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-tabular">
            {overview.kpis.total_mentions.toLocaleString('id-ID')} berita terindeks Google News ID
          </span>
        </div>
      </div>

      {/* 4. Three-State Responsive Intelligence Grid (1 col mobile -> 2 col tablet -> 8:4 desktop) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 sm:gap-6 items-start">
        
        {/* LEFT / MAIN ANALYTICAL STAGE (8 COLUMNS ON XL) */}
        <div className="xl:col-span-8 space-y-4 sm:space-y-6 min-w-0">
          {/* Primary Timeseries Telemetry Studio */}
          {isTimeseriesLoading ? (
            <div className="h-84 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
          ) : (
            <TimeseriesChart timeline={timeseriesData?.timeline || []} />
          )}

          {/* Asymmetric Intelligence Drivers (Topics 7 cols : Keywords 5 cols from md+) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 items-start">
            <div className="md:col-span-7 min-w-0">
              {isTrendsLoading ? (
                <div className="h-64 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
              ) : (
                <RisingTopicsCard
                  topics={filteredTopics}
                  onSelectTopic={onNavigateToTopic}
                />
              )}
            </div>
            <div className="md:col-span-5 min-w-0">
              {isTrendsLoading ? (
                <div className="h-64 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
              ) : (
                <TopKeywordsCard
                  keywords={trendsData?.top_keywords || []}
                  onSelectKeyword={onNavigateToMentionsWithKeyword}
                />
              )}
            </div>
          </div>
        </div>

        {/* RIGHT / TACTICAL RAIL (4 COLUMNS ON XL, 2-COL SUBGRID ON MD-LG) */}
        <div className="xl:col-span-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-6 min-w-0">
          {/* Live Real-time Evidence Wire */}
          <div className="md:col-span-2 xl:col-span-1 min-w-0">
            <LiveEvidenceRail
              mentions={displayMentions}
              isLoading={isMentionsLoading}
              onSelectMention={(mention) => setSelectedMention(mention)}
              onViewAllMentions={() => onNavigateToMentionsWithKeyword('')}
              onAskAi={(query) => onOpenAiWithQuery?.(query)}
            />
          </div>

          {/* Sentiment Polarization Matrix */}
          <div className="min-w-0">
            <SentimentDistribution
              positive={overview.sentiment.positive}
              neutral={overview.sentiment.neutral}
              negative={overview.sentiment.negative}
              unknown={overview.sentiment.unknown}
            />
          </div>

          {/* Platform Ingestion Share */}
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
