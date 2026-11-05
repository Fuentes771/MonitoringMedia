import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, DashboardOverview } from '@/lib/api';
import { Sidebar, NavTab } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { OverviewPage } from '@/pages/OverviewPage';
import { MentionsPage } from '@/pages/MentionsPage';
import { TopicsPage } from '@/pages/TopicsPage';
import { AlertsPage } from '@/pages/AlertsPage';
import { DataSourcesPage } from '@/pages/DataSourcesPage';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [isDark, setIsDark] = useState(true);
  const [days, setDays] = useState(7);
  const [isExporting, setIsExporting] = useState(false);

  // Selected filters passed across pages
  const [targetTopicId, setTargetTopicId] = useState<number | undefined>(undefined);
  const [targetKeyword, setTargetKeyword] = useState<string | undefined>(undefined);

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

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  };

  const handleNavigateToTopic = (topicId: number) => {
    setTargetTopicId(topicId);
    setTargetKeyword(undefined);
    setCurrentTab('mentions');
  };

  const handleNavigateToMentionsWithKeyword = (kw: string) => {
    setTargetKeyword(kw);
    setTargetTopicId(undefined);
    setCurrentTab('mentions');
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
      link.setAttribute('download', `pulsescope_export_${new Date().toISOString().slice(0, 10)}.csv`);
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
    <div className={`min-h-screen flex ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab !== 'mentions') {
            setTargetTopicId(undefined);
            setTargetKeyword(undefined);
          }
        }}
        onExportCsv={handleExportCsv}
        isExporting={isExporting}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          isDark={isDark}
          onToggleTheme={toggleTheme}
          coverage={overview?.coverage}
          onRefresh={() => refetchOverview()}
          isRefreshing={isFetching}
          days={days}
          onChangeDays={setDays}
        />

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto overflow-y-auto">
          {currentTab === 'overview' && (
            <OverviewPage
              days={days}
              onNavigateToTopic={handleNavigateToTopic}
              onNavigateToMentionsWithKeyword={handleNavigateToMentionsWithKeyword}
            />
          )}

          {currentTab === 'mentions' && (
            <MentionsPage
              initialKeyword={targetKeyword}
              initialTopicId={targetTopicId}
            />
          )}

          {currentTab === 'topics' && <TopicsPage />}

          {currentTab === 'alerts' && <AlertsPage />}

          {currentTab === 'sources' && <DataSourcesPage />}
        </main>
      </div>
    </div>
  );
}
