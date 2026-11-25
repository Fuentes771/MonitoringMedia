import { lazy, Suspense, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, DashboardOverview, HotIssuesRadarData } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { Sidebar, NavTab } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { FloatingAiAssistantButton } from '@/components/ai/FloatingAiAssistantButton';

const OverviewPage = lazy(() =>
  import('@/pages/OverviewPage').then((m) => ({ default: m.OverviewPage }))
);
const MentionsPage = lazy(() =>
  import('@/pages/MentionsPage').then((m) => ({ default: m.MentionsPage }))
);
const TopicsPage = lazy(() =>
  import('@/pages/TopicsPage').then((m) => ({ default: m.TopicsPage }))
);
const AlertsPage = lazy(() =>
  import('@/pages/AlertsPage').then((m) => ({ default: m.AlertsPage }))
);
const DataSourcesPage = lazy(() =>
  import('@/pages/DataSourcesPage').then((m) => ({ default: m.DataSourcesPage }))
);
const HotIssuesPage = lazy(() =>
  import('@/pages/HotIssuesPage').then((m) => ({ default: m.HotIssuesPage }))
);
const BuzzerRadarPage = lazy(() =>
  import('@/pages/BuzzerRadarPage').then((m) => ({ default: m.BuzzerRadarPage }))
);
const AiIntelligenceDrawer = lazy(() =>
  import('@/components/ai/AiIntelligenceDrawer').then((m) => ({
    default: m.AiIntelligenceDrawer,
  }))
);

function PageRouteFallback() {
  return (
    <div className="space-y-4 sm:space-y-6" aria-busy="true" aria-label="Memuat halaman">
      <div className="h-12 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse" />
      <div className="h-56 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        <div className="lg:col-span-8 h-72 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
        <div className="lg:col-span-4 h-72 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
      </div>
    </div>
  );
}

export default function App() {
  const queryClient = useQueryClient();
  const { status, activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;

  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [days, setDays] = useState(7);
  const [organicOnly, setOrganicOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [hasOpenedAiDrawer, setHasOpenedAiDrawer] = useState(false);
  const [aiInitialQuery, setAiInitialQuery] = useState<string | undefined>(undefined);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Enforce permanent Dark Mode (Stealth Intelligence Theme)
  useEffect(() => {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    try {
      localStorage.removeItem('theme');
    } catch {
      // ignore
    }
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K opens Mentions Explorer search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCurrentTab('mentions');
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Selected filters passed across pages
  const [targetTopicId, setTargetTopicId] = useState<number | undefined>(undefined);
  const [targetKeyword, setTargetKeyword] = useState<string | undefined>(undefined);
  const [targetSentiment, setTargetSentiment] = useState<string | undefined>(undefined);
  const [targetAuthorName, setTargetAuthorName] = useState<string | undefined>(undefined);
  const [targetBotClusterId, setTargetBotClusterId] = useState<string | undefined>(undefined);
  const [targetOnlyInauthentic, setTargetOnlyInauthentic] = useState<boolean>(false);

  const resetMentionTargets = () => {
    setTargetTopicId(undefined);
    setTargetKeyword(undefined);
    setTargetSentiment(undefined);
    setTargetAuthorName(undefined);
    setTargetBotClusterId(undefined);
    setTargetOnlyInauthentic(false);
  };

  const navigateTab = (tab: NavTab) => {
    setCurrentTab(tab);
    setIsMobileMenuOpen(false);
    if (tab !== 'mentions') {
      resetMentionTargets();
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Fetch overview data shared with OverviewPage via identical queryKey (deduplicated)
  const { data: overview, refetch: refetchOverview, isFetching } = useQuery({
    queryKey: ['dashboard-overview', workspaceId, days, organicOnly],
    enabled: status === 'authenticated' && Boolean(workspaceId),
    queryFn: async () => {
      const res = await api.get<DashboardOverview>('/dashboard/overview', {
        params: {
          workspace_id: workspaceId,
          days,
          exclude_inauthentic: organicOnly || undefined,
        },
      });
      return res.data;
    },
  });

  // Lightweight surge badge check (never triggers synchronous RSS auto-discovery on dashboard boot)
  const { data: hotIssuesData } = useQuery({
    queryKey: ['hot-issues-badge', workspaceId],
    enabled: status === 'authenticated' && Boolean(workspaceId),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get<{ data: HotIssuesRadarData }>('/hot-issues', {
        params: { workspace_id: workspaceId, skip_autodiscover: 1 },
      });
      return res.data.data;
    },
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  const hasSurge = (hotIssuesData?.surging_count ?? 0) > 0;

  const conducivePercent = (() => {
    if (!overview?.sentiment) return undefined;
    const total =
      overview.sentiment.positive +
      overview.sentiment.neutral +
      overview.sentiment.negative;
    if (total === 0) return 0;
    return Math.round(((overview.sentiment.positive + overview.sentiment.neutral) / total) * 100);
  })();

  const handleNavigateToTopic = (topicId?: number) => {
    resetMentionTargets();
    setTargetTopicId(topicId);
    setCurrentTab('mentions');
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleNavigateToMentionsWithKeyword = (kw: string) => {
    resetMentionTargets();
    setTargetKeyword(kw);
    setCurrentTab('mentions');
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleNavigateToMentionsWithFilters = (
    topicId?: number,
    sentiment?: string,
    keyword?: string,
    extra?: { authorName?: string; botClusterId?: string; onlyInauthentic?: boolean }
  ) => {
    setTargetTopicId(topicId);
    setTargetSentiment(sentiment);
    setTargetKeyword(keyword);
    setTargetAuthorName(extra?.authorName);
    setTargetBotClusterId(extra?.botClusterId);
    setTargetOnlyInauthentic(Boolean(extra?.onlyInauthentic));
    setCurrentTab('mentions');
    setIsMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleOpenAiWithQuery = (query: string, topicId?: number) => {
    if (topicId) setTargetTopicId(topicId);
    setAiInitialQuery(query);
    setHasOpenedAiDrawer(true);
    setIsAiDrawerOpen(true);
  };

  const handleRefreshWorkspaceData = () => {
    void refetchOverview();
    void queryClient.invalidateQueries({ queryKey: ['dashboard-timeseries', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['trends', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['recent-mentions', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['hot-issues-badge', workspaceId] });
  };

  // CSV Export action
  const handleExportCsv = async () => {
    if (!workspaceId) return;
    setIsExporting(true);
    try {
      const response = await api.post(
        '/reports/export',
        { workspace_id: workspaceId },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `trinetra_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (status === 'booting') {
    return (
      <div className="min-h-dvh bg-[#08090d] text-[#f4f5f8] font-sans-ui flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
          <img
            src="/brand/trinetra-logo.svg"
            alt="Lambang TRINETRA"
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
          />
          <div className="flex items-center gap-2 text-sm text-[#9da3ae]">
            <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" aria-hidden="true" />
            <span>Memverifikasi sesi...</span>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <LoginPage />;
  }

  return (
    <div className="min-h-dvh flex font-sans-ui relative isolate bg-[#08090d] text-[#f4f5f8] selection:bg-amber-500/20 selection:text-amber-200 overflow-x-clip">
      {/* Ambient Telemetry Backdrop (lightweight non-blended layer to avoid full-screen GPU repaints) */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[520px] sm:h-[720px] pointer-events-none -z-10 opacity-25 sm:opacity-30 bg-cover bg-top bg-no-repeat"
        style={{ backgroundImage: `url('/brand/ambient-backdrop.webp')` }}
      />
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 h-[520px] sm:h-[720px] pointer-events-none -z-10 bg-gradient-to-b from-transparent via-[#08090d]/45 to-[#08090d]"
      />

      {/* Sidebar Navigation (Desktop persistent + Mobile/Tablet slide-over drawer) */}
      <div className="shrink-0">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={navigateTab}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          conducivePercent={conducivePercent}
          totalMentionsCount={overview?.kpis?.total_mentions}
          hasSurge={hasSurge}
        />
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          currentTab={currentTab}
          coverage={overview?.coverage}
          onRefresh={handleRefreshWorkspaceData}
          isRefreshing={isFetching}
          days={days}
          onChangeDays={setDays}
          onNavigateToAlerts={() => navigateTab('alerts')}
          organicOnly={organicOnly}
          onToggleOrganicOnly={() => setOrganicOnly((v) => !v)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          isMobileMenuOpen={isMobileMenuOpen}
        />

        <main className="flex-1 px-3.5 py-4 sm:px-5 sm:py-6 lg:p-8 pb-[calc(7.5rem+env(safe-area-inset-bottom,0px))] md:pb-10 max-w-7xl w-full mx-auto min-w-0">
          <Suspense fallback={<PageRouteFallback />}>
            {currentTab === 'overview' && (
              <OverviewPage
                days={days}
                organicOnly={organicOnly}
                onNavigateToTopic={handleNavigateToTopic}
                onNavigateToMentionsWithKeyword={handleNavigateToMentionsWithKeyword}
                onOpenAiWithQuery={handleOpenAiWithQuery}
              />
            )}

            {currentTab === 'hot_issues' && (
              <HotIssuesPage
                onNavigateToMentions={handleNavigateToTopic}
                onOpenAiWithQuery={handleOpenAiWithQuery}
              />
            )}

            {currentTab === 'bot_radar' && (
              <BuzzerRadarPage
                days={days}
                onOpenAiWithQuery={handleOpenAiWithQuery}
                onNavigateToMentionsWithFilters={handleNavigateToMentionsWithFilters}
              />
            )}

            {currentTab === 'mentions' && (
              <MentionsPage
                initialKeyword={targetKeyword}
                initialTopicId={targetTopicId}
                initialSentiment={targetSentiment}
                initialAuthorName={targetAuthorName}
                initialBotClusterId={targetBotClusterId}
                initialOnlyInauthentic={targetOnlyInauthentic}
                organicOnly={organicOnly}
                onOpenAiWithQuery={handleOpenAiWithQuery}
              />
            )}

            {currentTab === 'topics' && (
              <TopicsPage
                onNavigateToMentions={handleNavigateToTopic}
                onOpenAiWithQuery={handleOpenAiWithQuery}
              />
            )}

            {currentTab === 'alerts' && (
              <AlertsPage
                onNavigateToMentions={handleNavigateToMentionsWithFilters}
                onOpenAiWithQuery={handleOpenAiWithQuery}
              />
            )}

            {currentTab === 'sources' && <DataSourcesPage />}
          </Suspense>
        </main>
      </div>

      {/* Mobile Primary Bottom Navigation Bar */}
      <MobileBottomNav
        currentTab={currentTab}
        onSelectTab={navigateTab}
        onOpenMenu={() => setIsMobileMenuOpen(true)}
        isMenuOpen={isMobileMenuOpen}
        hasSurge={hasSurge}
      />

      {/* Floating Action Button (FAB) Bottom-Right AI Assistant */}
      <FloatingAiAssistantButton
        onClick={() => {
          setAiInitialQuery(undefined);
          setHasOpenedAiDrawer(true);
          setIsAiDrawerOpen(true);
        }}
        isOpen={isAiDrawerOpen || isMobileMenuOpen}
      />

      {/* AI Intelligence Chatbot Drawer (lazy-mounted on first open) */}
      {hasOpenedAiDrawer && (
        <Suspense fallback={null}>
          <AiIntelligenceDrawer
            isOpen={isAiDrawerOpen}
            onClose={() => {
              setIsAiDrawerOpen(false);
              setAiInitialQuery(undefined);
            }}
            selectedTopicId={targetTopicId}
            initialQuery={aiInitialQuery}
          />
        </Suspense>
      )}
    </div>
  );
}
