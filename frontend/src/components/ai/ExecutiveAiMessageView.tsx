import { useMemo } from 'react';
import {
  AlertTriangle,
  Scale,
  Sparkles,
  CheckCircle2,
  Bookmark,
} from 'lucide-react';

interface ExecutiveAiMessageViewProps {
  content: string;
}

interface ParsedExecutiveMessage {
  summary: string | null;
  sentiment: {
    posPct: number;
    neuPct: number;
    negPct: number;
    posCount?: string;
    neuCount?: string;
    negCount?: string;
  } | null;
  highlights: Array<{
    type: 'positive' | 'negative' | 'policy' | 'general';
    title: string;
    body: string;
  }>;
  fallbackText: string | null;
}

export function ExecutiveAiMessageView({ content }: ExecutiveAiMessageViewProps) {
  const parsed = useMemo<ParsedExecutiveMessage>(() => {
    const raw = content.trim();

    // Check if message follows the executive structured format
    const hasSummaryHeader = /#*\s*📌?\s*Ringkasan Eksekutif/i.test(raw);
    const hasSentimentHeader = /#*\s*📊?\s*Distribusi Sentimen/i.test(raw);
    const hasHighlightsHeader = /#*\s*🔍?\s*Sorotan Isu/i.test(raw);

    if (!hasSummaryHeader && !hasSentimentHeader && !hasHighlightsHeader) {
      // General conversational message: clean markdown symbols like '###', '**', '---' and brackets
      const cleaned = raw
        .replace(/^#+\s+/gm, '')
        .replace(/---/g, '')
        .replace(/\*\*/g, '')
        .replace(/\([^)]*(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)[^)]*\)/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      return { summary: null, sentiment: null, highlights: [], fallbackText: cleaned };
    }

    let summaryText: string | null = null;
    let sentimentData: ParsedExecutiveMessage['sentiment'] = null;
    const highlightsList: ParsedExecutiveMessage['highlights'] = [];

    // 1. Extract Summary
    const summaryMatch = raw.match(/#*\s*📌?\s*Ringkasan Eksekutif\s*\n+([\s\S]*?)(?=\n+#*\s*📊|\n+#*\s*🔍|\n+---|\s*$)/i);
    if (summaryMatch && summaryMatch[1]) {
      summaryText = summaryMatch[1]
        .replace(/---/g, '')
        .replace(/\*\*/g, '')
        .replace(/\([^)]*(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des)[^)]*\)/gi, '')
        .replace(/\([^)]*(?:InfoPublik|Kompas|Tempo|Detik|Antara|Disway|Tirto|Media|Berita)[^)]*\)/gi, '')
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
    }

    // 2. Extract Sentiment Barometer
    const sentimentMatch = raw.match(/#*\s*📊?\s*Distribusi Sentimen[^\n]*\n+([\s\S]*?)(?=\n+#*\s*🔍|\n+---|\s*$)/i);
    if (sentimentMatch && sentimentMatch[1]) {
      const sentText = sentimentMatch[1];
      // Search for percentages and counts: e.g., Positif: 30% (6 sebutan)
      const posMatch = sentText.match(/Positif[^\d]*(\d+)%?(?:\s*\((\d+)[^\)]*\))?/i);
      const neuMatch = sentText.match(/Netral[^\d]*(\d+)%?(?:\s*\((\d+)[^\)]*\))?/i);
      const negMatch = sentText.match(/Negatif[^\d]*(\d+)%?(?:\s*\((\d+)[^\)]*\))?/i);

      if (posMatch || neuMatch || negMatch) {
        sentimentData = {
          posPct: posMatch ? parseInt(posMatch[1], 10) : 0,
          neuPct: neuMatch ? parseInt(neuMatch[1], 10) : 0,
          negPct: negMatch ? parseInt(negMatch[1], 10) : 0,
          posCount: posMatch && posMatch[2] ? posMatch[2] : undefined,
          neuCount: neuMatch && neuMatch[2] ? neuMatch[2] : undefined,
          negCount: negMatch && negMatch[2] ? negMatch[2] : undefined,
        };
      }
    }

    // 3. Extract Highlights
    const highlightsMatch = raw.match(/#*\s*🔍?\s*Sorotan Isu[^\n]*\n+([\s\S]*?)$/i);
    if (highlightsMatch && highlightsMatch[1]) {
      const hlText = highlightsMatch[1];
      const lines = hlText.split(/\n(?=-|\*|•)/);

      for (const line of lines) {
        const trimmed = line.replace(/^[-*•]\s*/, '').trim();
        if (!trimmed) continue;

        let type: 'positive' | 'negative' | 'policy' | 'general' = 'general';
        let title = 'Sorotan Isu';
        let body = trimmed;

        if (/Katalis Positif|Positif/i.test(trimmed)) {
          type = 'positive';
          title = 'Katalis Positif & Progres';
          body = trimmed.replace(/^(\*\*)?Katalis Positif(\*\*)?:\s*/i, '').replace(/^(\*\*)?Positif(\*\*)?:\s*/i, '');
        } else if (/Tantangan|Risiko|Negatif|Kritis/i.test(trimmed)) {
          type = 'negative';
          title = 'Tantangan, Risiko & Kendala';
          body = trimmed.replace(/^(\*\*)?Tantangan & Risiko(\*\*)?:\s*/i, '').replace(/^(\*\*)?Risiko(\*\*)?:\s*/i, '');
        } else if (/Tata Kelola|Kebijakan|Regulasi/i.test(trimmed)) {
          type = 'policy';
          title = 'Tata Kelola & Kebijakan';
          body = trimmed.replace(/^(\*\*)?Tata Kelola \/ Kebijakan(\*\*)?:\s*/i, '').replace(/^(\*\*)?Kebijakan(\*\*)?:\s*/i, '');
        }

        // Clean any residual double-asterisks and source citations
        body = body
          .replace(/\*\*/g, '')
          .replace(/---/g, '')
          .replace(/\([^)]*(?:Jan|Feb|Mar|Apr|Mei|Jun|Jul|Agu|Sep|Okt|Nov|Des|\d{1,2}\s+[A-Za-z]{3,4})[^)]*\)/gi, '')
          .replace(/\([^)]*(?:InfoPublik|Kompas|Tempo|Detik|Antara|Disway|Tirto|Media|Berita)[^)]*\)/gi, '')
          .replace(/\[[^\]]+\]/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (body) {
          highlightsList.push({ type, title, body });
        }
      }
    }

    return {
      summary: summaryText,
      sentiment: sentimentData,
      highlights: highlightsList,
      fallbackText: null,
    };
  }, [content]);

  // If general message without executive sections
  if (parsed.fallbackText) {
    return (
      <div className="text-zinc-200 leading-relaxed text-[13.5px] whitespace-pre-wrap">
        {parsed.fallbackText}
      </div>
    );
  }

  return (
    <div className="space-y-3.5 text-zinc-100 font-sans-ui">
      {/* 1. Executive Summary Card */}
      {parsed.summary && (
        <div className="p-3.5 rounded-xl bg-gradient-to-br from-cyan-950/30 via-[#0e1424] to-[#0a0f1d] border border-cyan-500/25 shadow-md">
          <div className="flex items-center gap-2 mb-1.5 text-cyan-300 text-xs font-bold tracking-wide uppercase">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ringkasan Eksekutif</span>
          </div>
          <p className="text-[13px] text-zinc-200 leading-relaxed font-sans-ui">
            {parsed.summary}
          </p>
        </div>
      )}

      {/* 2. Visual Sentiment Distribution Barometer */}
      {parsed.sentiment && (
        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono-code">
              Distribusi Sentimen Publik
            </span>
            <div className="flex items-center gap-2 text-[11px] font-mono-code">
              <span className="text-emerald-400 font-semibold">
                🟢 {parsed.sentiment.posPct}% {parsed.sentiment.posCount ? `(${parsed.sentiment.posCount})` : ''}
              </span>
              <span className="text-zinc-400 font-semibold">
                ⚪ {parsed.sentiment.neuPct}% {parsed.sentiment.neuCount ? `(${parsed.sentiment.neuCount})` : ''}
              </span>
              <span className="text-rose-400 font-semibold">
                🔴 {parsed.sentiment.negPct}% {parsed.sentiment.negCount ? `(${parsed.sentiment.negCount})` : ''}
              </span>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="w-full h-2.5 bg-white/[0.06] rounded-full overflow-hidden flex border border-white/10">
            <div
              style={{ width: `${parsed.sentiment.posPct}%` }}
              className="h-full bg-emerald-500 transition-all duration-300"
              title={`Positif: ${parsed.sentiment.posPct}%`}
            />
            <div
              style={{ width: `${parsed.sentiment.neuPct}%` }}
              className="h-full bg-zinc-500 transition-all duration-300"
              title={`Netral: ${parsed.sentiment.neuPct}%`}
            />
            <div
              style={{ width: `${parsed.sentiment.negPct}%` }}
              className="h-full bg-rose-500 transition-all duration-300"
              title={`Negatif: ${parsed.sentiment.negPct}%`}
            />
          </div>
        </div>
      )}

      {/* 3. Strategic Highlights Color-Coded Cards */}
      {parsed.highlights.length > 0 && (
        <div className="space-y-2.5 pt-1">
          <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider font-mono-code">
            Sorotan Isu Strategis
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {parsed.highlights.map((hl, i) => {
              const isPos = hl.type === 'positive';
              const isNeg = hl.type === 'negative';
              const isPol = hl.type === 'policy';

              return (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                    isPos
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : isNeg
                      ? 'bg-rose-950/25 border-rose-500/35'
                      : isPol
                      ? 'bg-blue-950/25 border-blue-500/30'
                      : 'bg-white/[0.02] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold tracking-tight">
                    {isPos && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    {isNeg && <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                    {isPol && <Scale className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    {!isPos && !isNeg && !isPol && <Bookmark className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}

                    <span
                      className={
                        isPos
                          ? 'text-emerald-300'
                          : isNeg
                          ? 'text-rose-300'
                          : isPol
                          ? 'text-blue-300'
                          : 'text-zinc-200'
                      }
                    >
                      {hl.title}
                    </span>
                  </div>

                  <p className="text-[12.5px] text-zinc-200 leading-relaxed font-sans-ui pl-5">
                    {hl.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
