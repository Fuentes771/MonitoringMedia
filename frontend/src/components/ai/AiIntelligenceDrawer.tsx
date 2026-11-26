import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Send,
  X,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Flame,
  FileText,
  AlertTriangle,
  BarChart3,
  MessageSquareText,
} from 'lucide-react';
import { api, AiGatewayStatus, AiChatResponse, AiCitation, TopicItem } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { ExecutiveAiMessageView } from './ExecutiveAiMessageView';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AiCitation[];
  grounded?: boolean;
  model?: string;
  timestamp: string;
}

interface AiIntelligenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTopicId?: number;
  initialQuery?: string;
}

export function AiIntelligenceDrawer({
  isOpen,
  onClose,
  selectedTopicId,
  initialQuery,
}: AiIntelligenceDrawerProps) {
  const [activeTopicId, setActiveTopicId] = useState<number | undefined>(selectedTopicId);
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        'Halo, saya Analis AI TRINETRA. Pilih program prioritas di atas atau ketik pertanyaan isu yang ingin Anda bedah hari ini.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedInitialQuery = useRef<string | undefined>(undefined);

  // Close on Escape key press & lock body scroll while open (R-32)
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (selectedTopicId) {
      setActiveTopicId(selectedTopicId);
    }
  }, [selectedTopicId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSubmitting]);

  useEffect(() => {
    if (isOpen && initialQuery && initialQuery !== lastProcessedInitialQuery.current) {
      lastProcessedInitialQuery.current = initialQuery;
      void handleSend(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const { data: gatewayStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['ai-gateway-status'],
    enabled: isOpen,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await api.get<{ status: string; data: AiGatewayStatus }>('/ai/status');
      return res.data.data;
    },
    refetchInterval: isOpen ? 60_000 : false,
    refetchIntervalInBackground: false,
  });

  const { activeWorkspace } = useAuth();
  const workspaceId = activeWorkspace?.id;

  const { data: topics = [] } = useQuery({
    queryKey: ['topics-list', workspaceId],
    enabled: isOpen && Boolean(workspaceId),
    staleTime: 120_000,
    queryFn: async () => {
      const res = await api.get<{ status: string; data: TopicItem[] }>(
        `/workspaces/${workspaceId}/topics`
      );
      return res.data.data;
    },
    select: (items) => items.filter((t) => t.status === 'active'),
  });

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputQuery;
    if (!textToSend.trim() || isSubmitting) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInputQuery('');
    setIsSubmitting(true);

    try {
      const historyPayload = messages.slice(-4).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.post<{ status: string; data: AiChatResponse }>('/ai/chat', {
        workspace_id: workspaceId,
        query: textToSend.trim(),
        topic_id: activeTopicId || undefined,
        conversation_history: historyPayload,
      });

      const aiData = res.data.data;
      const assistantMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: aiData.answer,
        citations: aiData.citations,
        grounded: aiData.grounded,
        model: aiData.model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Gagal memproses analisis data saat ini. Silakan coba kembali. ${errorObj.response?.data?.message || errorObj.message || ''}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isOnline = gatewayStatus?.['9router']?.status === 'online';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[var(--bg-backdrop)] backdrop-blur-xs">
      <div className="flex-1" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Asisten Analis AI TRINETRA"
        className="w-full max-w-xl bg-[var(--bg-surface)] border-l border-[var(--border-medium)] flex flex-col h-dvh shadow-[var(--shadow-elevated)] overscroll-y-contain font-sans-ui"
      >
        {/* Header */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 bg-[var(--bg-surface)] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] flex items-center justify-center text-[var(--accent-gold-text)] shrink-0">
              <MessageSquareText className="w-4.5 h-4.5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <h2 className="font-editorial text-lg font-medium text-[var(--text-primary)] truncate">
                  Asisten Analis TRINETRA
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10.5px] font-semibold border shrink-0 ${
                    isOnline
                      ? 'bg-[var(--sentiment-pos-subtle)] text-[var(--sentiment-pos)] border-[var(--sentiment-pos-border)]'
                      : 'bg-[var(--accent-gold-subtle)] text-[var(--accent-gold-text)] border-[var(--accent-gold-border)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-[var(--sentiment-pos-bar)]' : 'bg-[var(--accent-gold)]'
                    }`}
                  />
                  {isOnline ? 'Terhubung' : 'Siaga'}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate">
                Sintesis persepsi kebijakan dan tren percakapan publik
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => void refetchStatus()}
              title="Perbarui status koneksi"
              aria-label="Perbarui status koneksi AI"
              className="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Tutup panel AI (Esc)"
              aria-label="Tutup panel asisten AI"
              className="min-w-11 min-h-11 sm:min-w-9 sm:min-h-9 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-surface-elevated)] transition-colors"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Focused Program Selector */}
        <div className="px-4 sm:px-5 py-3 bg-[var(--bg-canvas)] border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shrink-0">
          <label htmlFor="ai-drawer-topic-select" className="flex items-center gap-2 text-[var(--text-secondary)] font-medium shrink-0">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />
            <span>Fokus Program</span>
          </label>
          <select
            id="ai-drawer-topic-select"
            value={activeTopicId || ''}
            onChange={(e) => setActiveTopicId(e.target.value ? Number(e.target.value) : undefined)}
            className="input-field w-full sm:max-w-[290px] min-h-11 sm:min-h-9 px-3 py-1.5 text-sm sm:text-xs truncate"
          >
            <option value="">Semua 17 Program Prioritas</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.mentions_count} sebutan)
              </option>
            ))}
          </select>
        </div>

        {/* Strategic Quick Prompts */}
        <div className="px-4 sm:px-5 py-3 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] space-y-2 shrink-0">
          <div className="text-xs font-semibold text-[var(--text-secondary)]">
            Aksi Analisis Cepat
          </div>
          <div className="flex sm:grid sm:grid-cols-3 gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() =>
                void handleSend(
                  'Sajikan Executive 24h SitRep (Rangkuman 24 Jam) mengenai dinamika persepsi publik, isu terhangat, dan sentimen 17 program prioritas.'
                )
              }
              disabled={isSubmitting}
              className="pill-row min-w-[168px] sm:min-w-0 shrink-0 min-h-12 p-3 text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <FileText className="w-3.5 h-3.5 shrink-0 text-[var(--accent-gold-text)]" aria-hidden="true" />
                <span className="truncate">Laporan 24 Jam</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                Rangkuman isu prioritas
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                void handleSend(
                  'Analisis mendalam Matriks Risiko Sentimen Negatif: program mana yang memiliki resistensi atau sentimen negatif tertinggi, penyebab utama, dan rekomendasi mitigasinya?'
                )
              }
              disabled={isSubmitting}
              className="pill-row min-w-[168px] sm:min-w-0 shrink-0 min-h-12 p-3 text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[var(--sentiment-neg)]" aria-hidden="true" />
                <span className="truncate">Matriks Risiko</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                Isu kritis dan mitigasi
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                void handleSend(
                  'Sajikan Skor Persepsi Publik 17 Program Prioritas: urutkan dari yang paling diapresiasi hingga paling banyak dikritik, lengkap dengan isu kunci.'
                )
              }
              disabled={isSubmitting}
              className="pill-row min-w-[168px] sm:min-w-0 shrink-0 min-h-12 p-3 text-left disabled:opacity-50"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
                <BarChart3 className="w-3.5 h-3.5 shrink-0 text-[var(--sentiment-pos)]" aria-hidden="true" />
                <span className="truncate">Skor 17 Program</span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                Komparasi persepsi publik
              </p>
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto overscroll-y-contain p-4 sm:p-5 space-y-4 text-sm bg-[var(--bg-canvas)]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[88%] rounded-2xl p-3.5 sm:p-4 min-w-0 break-words ${
                  msg.role === 'user'
                    ? 'bg-[var(--action-contrast-bg)] text-[var(--action-contrast-fg)] rounded-br-sm text-[13.5px]'
                    : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-bl-sm w-full'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <ExecutiveAiMessageView content={msg.content} />
                ) : (
                  <div className="leading-relaxed">{msg.content}</div>
                )}

                <div
                  className={`text-[10px] mt-2 text-right font-tabular ${
                    msg.role === 'user' ? 'opacity-70' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isSubmitting && (
            <div className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
              <div className="px-4 py-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent-gold-text)]" aria-hidden="true" />
                <span>Menyusun analisis berdasarkan data terbaru...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Topic Shortcuts */}
        {topics.length > 0 && (
          <div className="px-4 sm:px-5 py-2.5 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            <span className="text-[11px] font-semibold text-[var(--accent-gold-text)] shrink-0 inline-flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Topik:</span>
            </span>
            {topics.slice(0, 5).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  void handleSend(
                    `Bagaimana analisis sentimen publik dan perkembangan isu terkini terkait program ${t.name}?`
                  )
                }
                className="min-h-8 text-[11px] px-3 py-1 rounded-full bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] shrink-0 transition-colors font-medium"
              >
                {t.name} ({t.mentions_count})
              </button>
            ))}
          </div>
        )}

        {/* Composer */}
        <div className="p-3.5 sm:p-4 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              aria-label="Pertanyaan untuk Asisten Analis TRINETRA"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Tanyakan analisis program atau isu publik..."
              disabled={isSubmitting}
              className="input-field flex-1 min-w-0 min-h-11 px-3.5 py-2.5 text-base sm:text-sm"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isSubmitting}
              aria-label="Kirim pertanyaan ke AI"
              className="btn-gold min-h-11 px-4 text-xs sm:text-sm inline-flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <>
                  <span className="hidden sm:inline">Kirim</span>
                  <Send className="w-4 h-4" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
