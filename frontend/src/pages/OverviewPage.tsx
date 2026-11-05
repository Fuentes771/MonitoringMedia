import { useQuery } from '@tanstack/react-query';
import { api, DashboardOverview, TimelinePoint, MentionItem } from '@/lib/api';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { TimeseriesChart } from '@/components/dashboard/TimeseriesChart';
import { SentimentDistribution } from '@/components/dashboard/SentimentDistribution';
import { PlatformBreakdown } from '@/components/dashboard/PlatformBreakdown';
import { RisingTopicsCard } from '@/components/dashboard/RisingTopicsCard';
import { TopKeywordsCard } from '@/components/dashboard/TopKeywordsCard';
import { MentionList } from '@/components/mentions/MentionList';

interface OverviewPageProps {
  days: number;
  onNavigateToTopic: (topicId: number) => void;
  onNavigateToMentionsWithKeyword: (kw: string) => void;
}

export function OverviewPage({
  days,
  onNavigateToTopic,
  onNavigateToMentionsWithKeyword,
}: OverviewPageProps) {
  // 1. Fetch Overview KPIs
  const { data: overview, isLoading: isOverviewLoading, error: overviewError } = useQuery({
    queryKey: ['dashboard-overview', days],
    queryFn: async () => {
      const res = await api.get<DashboardOverview>('/dashboard/overview', {
        params: { workspace_id: 1, days },
      });
      return res.data;
    },
  });

  // 2. Fetch Timeseries
  const { data: timeseriesData, isLoading: isTimeseriesLoading } = useQuery({
    queryKey: ['dashboard-timeseries', days],
    queryFn: async () => {
      const res = await api.get<{ timeline: TimelinePoint[] }>('/dashboard/timeseries', {
        params: { workspace_id: 1, days },
      });
      return res.data;
    },
  });

  // 3. Fetch Trends
  const { data: trendsData } = useQuery({
    queryKey: ['trends'],
    queryFn: async () => {
      const res = await api.get('/trends', {
        params: { workspace_id: 1 },
      });
      return res.data.data;
    },
  });

  // 4. Fetch Recent Mentions
  const { data: recentMentions, isLoading: isMentionsLoading } = useQuery({
    queryKey: ['recent-mentions'],
    queryFn: async () => {
      const res = await api.get<{ data: MentionItem[] }>('/mentions', {
        params: { workspace_id: 1, per_page: 5 },
      });
      return res.data.data;
    },
  });

  if (isOverviewLoading || isTimeseriesLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-72 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (overviewError || !overview) {
    return (
      <div className="p-8 text-center border border-rose-900/40 rounded-xl bg-rose-950/20 text-rose-300">
        <p className="font-semibold text-sm mb-1">Gagal memuat data ringkasan dashboard.</p>
        <p className="text-xs text-rose-400">Pastikan backend server aktif dan database terhubung.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KpiRow
        totalMentions={overview.kpis.total_mentions}
        changePercent={overview.kpis.mentions_change_percent}
        negativeSharePercent={overview.kpis.negative_share_percent}
        risingTopicsCount={overview.kpis.rising_topics_count}
      />

      {/* Primary Timeseries Chart */}
      <TimeseriesChart timeline={timeseriesData?.timeline || []} />

      {/* Secondary Row: Sentiment Distribution + Platform Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SentimentDistribution
          positive={overview.sentiment.positive}
          neutral={overview.sentiment.neutral}
          negative={overview.sentiment.negative}
          unknown={overview.sentiment.unknown}
        />

        <PlatformBreakdown platforms={overview.platform_breakdown} />
      </div>

      {/* Tertiary Row: Rising Topics & Top Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RisingTopicsCard
          topics={trendsData?.rising_topics || []}
          onSelectTopic={onNavigateToTopic}
        />

        <TopKeywordsCard
          keywords={trendsData?.top_keywords || []}
          onSelectKeyword={onNavigateToMentionsWithKeyword}
        />
      </div>

      {/* Recent Mentions Evidence Panel */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              Cuplikan Percakapan Terkini
            </h2>
            <p className="text-xs text-slate-400">
              Bukti nyata percakapan publik dari sumber terhubung
            </p>
          </div>
        </div>

        <MentionList
          mentions={recentMentions || []}
          isLoading={isMentionsLoading}
        />
      </div>
    </div>
  );
}
