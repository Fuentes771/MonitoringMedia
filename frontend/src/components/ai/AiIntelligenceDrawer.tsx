import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  Bot,
  Send,
  X,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Flame,
  Zap,
  FileText,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { api, AiGatewayStatus, AiChatResponse, AiCitation, TopicItem } from '@/lib/api';
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
      content: 'Halo, saya TRINETRA AI. Siap menyajikan analisis intelijen dan rangkuman persepsi publik secara real-time.\n\nSilakan pilih topik atau ketik isu strategis yang ingin Anda telusuri hari ini.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastProcessedInitialQuery = useRef<string | undefined>(undefined);

  // Close on Escape key press (Antislop R-32)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (selectedTopicId) {
      setActiveTopicId(selectedTopicId);
    }
  }, [selectedTopicId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSubmitting]);

  // Handle injected initial query from outside components
  useEffect(() => {
    if (isOpen && initialQuery && initialQuery !== lastProcessedInitialQuery.current) {
      lastProcessedInitialQuery.current = initialQuery;
      handleSend(initialQuery);
    }
  }, [isOpen, initialQuery]);

  // Fetch 9Router Gateway Status
  const { data: gatewayStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['ai-gateway-status'],
    queryFn: async () => {
      const res = await api.get<{ status: string; data: AiGatewayStatus }>('/ai/status');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  // Fetch Topics for the Selector
  const { data: topics = [] } = useQuery({
    queryKey: ['active-topics'],
    queryFn: async () => {
      const res = await api.get<{ status: string; data: TopicItem[] }>('/workspaces/1/topics');
      return res.data.data.filter(t => t.status === 'active');
    },
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

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputQuery('');
    setIsSubmitting(true);

    try {
      const historyPayload = messages.slice(-4).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post<{ status: string; data: AiChatResponse }>('/ai/chat', {
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

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Maaf, terjadi kendala saat memproses analisis data. Silakan coba beberapa saat lagi. ${err.response?.data?.message || err.message || ''}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const isOnline = gatewayStatus?.['9router']?.status === 'online';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="flex-1" onClick={onClose} aria-label="Tutup panel asisten AI" />
      <div className="w-full max-w-xl bg-[#0b0d14] border-l border-white/10 flex flex-col h-full shadow-2xl animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#10131e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-zinc-950 shadow-sm shadow-amber-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-[15px] tracking-tight">Asisten AI TRINETRA</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  isOnline 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {isOnline ? 'Intelijen Aktif' : 'Mode Siaga'}
                </span>
              </div>
              <p className="text-[12px] text-zinc-400 mt-0.5">
                Analisis Persepsi Kebijakan &amp; Tren Publik Realtime
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchStatus()}
              title="Perbarui status koneksi"
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar: Focused Program */}
        <div className="px-5 py-2.5 bg-[#08090d] border-b border-white/[0.06] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium text-zinc-300">Fokus Program:</span>
          </div>
          <select
            value={activeTopicId || ''}
            onChange={(e) => setActiveTopicId(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-[#12151c] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-white max-w-[280px] focus:outline-none focus:border-amber-400/60 truncate"
          >
            <option value="">Semua 17 Program Prioritas</option>
            {topics.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.mentions_count} sebutan)
              </option>
            ))}
          </select>
        </div>

        {/* Curated Executive Strategic Presets (1-Klik) */}
        <div className="px-5 py-3 bg-[#0c0e17] border-b border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-mono-code font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Executive Strategic Toolkit (1-Klik)</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono-code">AI SYNTHESIS</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleSend("Sajikan Executive 24h SitRep (Rangkuman 24 Jam) mengenai dinamika persepsi publik, isu terhangat, dan sentimen 17 program prioritas.")}
              disabled={isSubmitting}
              className="p-2.5 rounded-xl bg-gradient-to-br from-amber-950/30 to-zinc-900/50 border border-amber-500/30 hover:border-amber-400/55 text-left transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 group-hover:text-amber-200">
                <FileText className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                <span className="truncate">Executive SitRep</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1 leading-tight">
                Rangkuman intelijen 24 jam
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleSend("Analisis mendalam Matriks Risiko Sentimen Negatif: program mana yang memiliki resistensi atau sentimen negatif tertinggi, penyebab utama, dan rekomendasi mitigasinya?")}
              disabled={isSubmitting}
              className="p-2.5 rounded-xl bg-gradient-to-br from-rose-900/30 to-rose-950/40 border border-rose-500/30 hover:border-rose-400/60 text-left transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300 group-hover:text-rose-200">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                <span className="truncate">Matriks Risiko Krisis</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1 leading-tight">
                Deteksi isu kritis &amp; mitigasi
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleSend("Sajikan Skor Persepsi Publik 17 Program Prioritas: urutkan dari yang paling diapresiasi hingga paling banyak dikritik, lengkap dengan isu kunci.")}
              disabled={isSubmitting}
              className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-900/30 to-emerald-950/40 border border-emerald-500/30 hover:border-emerald-400/60 text-left transition-all group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300 group-hover:text-emerald-200">
                <BarChart3 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                <span className="truncate">Skor 17 Program</span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1 leading-tight">
                Matriks komparasi persepsi
              </p>
            </button>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans-ui text-sm">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-amber-500/15 border border-amber-500/35 text-amber-50 rounded-br-none text-[13.5px]'
                  : 'bg-[#121522] border border-white/10 text-zinc-100 rounded-bl-none w-full'
              }`}>
                {msg.role === 'assistant' ? (
                  <ExecutiveAiMessageView content={msg.content} />
                ) : (
                  <div className="leading-relaxed">
                    {msg.content}
                  </div>
                )}

                <div className="text-[10px] text-zinc-500 mt-2 text-right">
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}

          {isSubmitting && (
            <div className="flex gap-3 justify-start items-center text-zinc-400 text-xs">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-[#181b28] border border-white/10 rounded-2xl px-4 py-3 text-zinc-400 flex items-center gap-2">
                <span>Sedang menyusun analisis data & persepsi publik...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dynamic Hot Issue Shortcuts (1-Klik Analisis Cepat) */}
        <div className="px-5 py-2.5 bg-[#0a0c12] border-t border-white/[0.06] flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-amber-400 shrink-0 flex items-center gap-1 font-mono-code">
            <Flame className="w-3.5 h-3.5" /> Isu Panas:
          </span>
          {topics.slice(0, 5).map((t) => (
            <button
              key={t.id}
              onClick={() => handleSend(`Bagaimana analisis sentimen publik dan perkembangan isu terkini terkait program ${t.name}?`)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-amber-500/15 text-zinc-300 hover:text-amber-200 border border-white/10 hover:border-amber-500/35 shrink-0 transition-all font-medium cursor-pointer"
            >
              {t.name} ({t.mentions_count})
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-white/10 bg-[#131622]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Tanyakan analisis sentimen 17 program prioritas..."
              disabled={isSubmitting}
              className="flex-1 bg-[#12151c] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400/60 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || isSubmitting}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-zinc-950 font-semibold text-sm flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Kirim</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
