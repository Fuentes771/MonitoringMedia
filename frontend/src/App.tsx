import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, DashboardOverview } from '@/lib/api';
import { Sidebar, NavTab } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { OverviewPage } from '@/pages/OverviewPage';
import { MentionsPage } from '@/pages/MentionsPage';
import { TopicsPage } from '@/pages/TopicsPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { DataSourcesPage } from '@/pages/DataSourcesPage';
import { HotIssuesPage } from '@/pages/HotIssuesPage';
import { BuzzerRadarPage } from '@/pages/BuzzerRadarPage';
import { AiIntelligenceDrawer } from '@/components/ai/AiIntelligenceDrawer';
import { FloatingAiAssistantButton } from '@/components/ai/FloatingAiAssistantButton';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [days, setDays] = useState(7);
  const [organicOnly, setOrganicOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [aiInitialQuery, setAiInitialQuery] = useState<string | undefined>(undefined);

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

  // Selected filters passed across pages
  const [targetTopicId, setTargetTopicId] = useState<number | undefined>(undefined);
  const [targetKeyword, setTargetKeyword] = useState<string | undefined>(undefined);
  const [targetSentiment, setTargetSentiment] = useState<string | undefined>(undefined);

  // Fetch overview data for topbar coverage strip
  const { data: overview, refetch: refetchOverview, isFetching } = useQuery({
    queryKey: ['dashboard-overview', days],
    queryFn: async () => {
      const res = await api.get<DashboardOverview>('/dashboard/overview', {
        params: { workspace_id: 1, days },
      });
      return res.data;
    },
  });

  const handleNavigateToTopic = (topicId: number) => {
    setTargetTopicId(topicId);
    setTargetKeyword(undefined);
    setTargetSentiment(undefined);
    setCurrentTab('mentions');
  };

  const handleNavigateToMentionsWithKeyword = (kw: string) => {
    setTargetKeyword(kw);
    setTargetTopicId(undefined);
    setTargetSentiment(undefined);
    setCurrentTab('mentions');
  };

  const handleNavigateToMentionsWithFilters = (topicId?: number, sentiment?: string, keyword?: string) => {
    setTargetTopicId(topicId);
    setTargetSentiment(sentiment);
    setTargetKeyword(keyword);
    setCurrentTab('mentions');
  };

  const handleOpenAiWithQuery = (query: string, topicId?: number) => {
    if (topicId) setTargetTopicId(topicId);
    setAiInitialQuery(query);
    setIsAiDrawerOpen(true);
  };

  // CSV Export action
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const response = await api.post(
        '/reports/export',
        { workspace_id: 1 },
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

  return (
    <div className="min-h-screen flex font-sans-ui relative bg-[#08090d] text-[#f4f5f8] selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* High-Visibility Ambient Telemetry Backdrop (Gambar 3) */}
      <div
        className="fixed top-0 left-0 right-0 h-[720px] pointer-events-none z-0 opacity-60 mix-blend-screen bg-cover bg-top bg-no-repeat transition-opacity duration-700"
        style={{ backgroundImage: `url('/brand/ambient-backdrop.jpg')` }}
      />
      <div className="fixed top-0 left-0 right-0 h-[720px] pointer-events-none z-0 bg-gradient-to-b from-transparent via-[#08090d]/30 to-[#08090d]" />

      {/* Sidebar Navigation */}
      <div className="relative z-20">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            if (tab !== 'mentions') {
              setTargetTopicId(undefined);
              setTargetKeyword(undefined);
              setTargetSentiment(undefined);
            }
          }}
          onExportCsv={handleExportCsv}
          isExporting={isExporting}
        />
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <Topbar
          currentTab={currentTab}
          coverage={overview?.coverage}
          onRefresh={() => refetchOverview()}
          isRefreshing={isFetching}
          days={days}
          onChangeDays={setDays}
          onNavigateToAlerts={() => setCurrentTab('alerts')}
          organicOnly={organicOnly}
          onToggleOrganicOnly={() => setOrganicOnly((v) => !v)}
        />

        <main className="flex-1 p-6 sm:p-8 max-w-7xl w-full mx-auto overflow-y-auto">
          {currentTab === 'overview' && (
            <OverviewPage
              days={days}
              organicOnly={organicOnly}
              onNavigateToTopic={handleNavigateToTopic}
              onNavigateToMentionsWithKeyword={handleNavigateToMentionsWithKeyword}
              onOpenAiWithQuery={handleOpenAiWithQuery}
            />
          )}

          {currentTab === 'hot_issues' && <HotIssuesPage />}

          {currentTab === 'bot_radar' && (
            <BuzzerRadarPage
              days={days}
              onOpenAiWithQuery={handleOpenAiWithQuery}
            />
          )}

          {currentTab === 'mentions' && (
            <MentionsPage
              initialKeyword={targetKeyword}
              initialTopicId={targetTopicId}
              initialSentiment={targetSentiment}
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
        </main>
      </div>

      {/* Floating Action Button (FAB) Bottom-Right AI Assistant */}
      <FloatingAiAssistantButton
        onClick={() => {
          setAiInitialQuery(undefined);
          setIsAiDrawerOpen(true);
        }}
        isOpen={isAiDrawerOpen}
      />

      {/* AI Intelligence Chatbot Drawer */}
      <AiIntelligenceDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => {
          setIsAiDrawerOpen(false);
          setAiInitialQuery(undefined);
        }}
        selectedTopicId={targetTopicId}
        initialQuery={aiInitialQuery}
      />
    </div>
  );
}
