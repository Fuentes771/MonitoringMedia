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

const RAIL_STORAGE_KEY = 'trinetra_rail_expanded';

function readInitialRailExpanded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(RAIL_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function PageRouteFallback() {
  return (
    <div className="space-y-5" role="status" aria-busy="true" aria-label="Memuat halaman">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 h-72 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="lg:col-span-5 h-72 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 h-80 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
        <div className="xl:col-span-4 h-80 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] animate-pulse" />
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
  const [isRailExpanded, setIsRailExpanded] = useState<boolean>(readInitialRailExpanded);

  const toggleRailExpanded = () => {
    setIsRailExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(RAIL_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

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

  // Shared overview query (deduplicated with OverviewPage)
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

  // Lightweight surge badge check (never triggers synchronous RSS auto-discovery on boot)
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
  const hasCriticalAlert = hasSurge || (overview?.kpis?.negative_share_percent ?? 0) > 25;

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
      <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] font-sans-ui flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
          <span className="w-14 h-14 rounded-full bg-[#181614] dark:bg-transparent border border-[var(--accent-gold-border)] dark:border-transparent flex items-center justify-center">
            <img
              src="/brand/trinetra-logo.svg"
              alt="Lambang TRINETRA"
              width={40}
              height={40}
              fetchPriority="high"
              className="w-10 h-10 object-contain"
            />
          </span>
          <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-gold-text)]" aria-hidden="true" />
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
    <div className="min-h-dvh flex font-sans-ui relative isolate bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-x-clip">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 px-4 py-2 rounded-xl bg-[var(--accent-gold)] text-[var(--accent-gold-ink)] text-xs font-bold"
      >
        Lompat ke konten utama
      </a>

      {/* Slim Expandable Navigation Rail (Desktop) & Slide-Over Drawer (Mobile/Tablet) */}
      <div className="shrink-0">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={navigateTab}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
          isExpanded={isRailExpanded}
          onToggleExpand={toggleRailExpanded}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          hasSurge={hasSurge}
        />
      </div>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          currentTab={currentTab}
          coverage={overview?.coverage}
          onRefresh={handleRefreshWorkspaceData}
          isRefreshing={isFetching}
          days={days}
          onChangeDays={setDays}
          onNavigateToAlerts={() => navigateTab('alerts')}
          onQuickSearch={() => navigateTab('mentions')}
          organicOnly={organicOnly}
          onToggleOrganicOnly={() => setOrganicOnly((v) => !v)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          isMobileMenuOpen={isMobileMenuOpen}
          hasAlertIndicator={hasCriticalAlert}
        />

        <main
          id="main-content"
          className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))] md:pb-12 max-w-[1440px] w-full mx-auto min-w-0"
        >
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

      {/* Floating AI Assistant Trigger */}
      <FloatingAiAssistantButton
        onClick={() => {
          setAiInitialQuery(undefined);
          setHasOpenedAiDrawer(true);
          setIsAiDrawerOpen(true);
        }}
        isOpen={isAiDrawerOpen || isMobileMenuOpen}
      />

      {/* AI Intelligence Drawer (lazy-mounted on first open) */}
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
