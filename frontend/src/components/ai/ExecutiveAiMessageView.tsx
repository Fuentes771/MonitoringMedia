import { useMemo } from 'react';
import {
  AlertTriangle,
  Scale,
  FileText,
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

    const hasSummaryHeader = /#*\s*📌?\s*Ringkasan Eksekutif/i.test(raw);
    const hasSentimentHeader = /#*\s*📊?\s*Distribusi Sentimen/i.test(raw);
    const hasHighlightsHeader = /#*\s*🔍?\s*Sorotan Isu/i.test(raw);

    if (!hasSummaryHeader && !hasSentimentHeader && !hasHighlightsHeader) {
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

    const summaryMatch = raw.match(
      /#*\s*📌?\s*Ringkasan Eksekutif\s*\n+([\s\S]*?)(?=\n+#*\s*📊|\n+#*\s*🔍|\n+---|\s*$)/i
    );
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

    const sentimentMatch = raw.match(
      /#*\s*📊?\s*Distribusi Sentimen[^\n]*\n+([\s\S]*?)(?=\n+#*\s*🔍|\n+---|\s*$)/i
    );
    if (sentimentMatch && sentimentMatch[1]) {
      const sentText = sentimentMatch[1];
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
          body = trimmed
            .replace(/^(\*\*)?Katalis Positif(\*\*)?:\s*/i, '')
            .replace(/^(\*\*)?Positif(\*\*)?:\s*/i, '');
        } else if (/Tantangan|Risiko|Negatif|Kritis/i.test(trimmed)) {
          type = 'negative';
          title = 'Tantangan, Risiko & Kendala';
          body = trimmed
            .replace(/^(\*\*)?Tantangan & Risiko(\*\*)?:\s*/i, '')
            .replace(/^(\*\*)?Risiko(\*\*)?:\s*/i, '');
        } else if (/Tata Kelola|Kebijakan|Regulasi/i.test(trimmed)) {
          type = 'policy';
          title = 'Tata Kelola & Kebijakan';
          body = trimmed
            .replace(/^(\*\*)?Tata Kelola \/ Kebijakan(\*\*)?:\s*/i, '')
            .replace(/^(\*\*)?Kebijakan(\*\*)?:\s*/i, '');
        }

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

  if (parsed.fallbackText) {
    return (
      <div className="text-[var(--text-primary)] leading-relaxed text-[13.5px] whitespace-pre-wrap">
        {parsed.fallbackText}
      </div>
    );
  }

  return (
    <div className="space-y-3.5 text-[var(--text-primary)] font-sans-ui">
      {parsed.summary && (
        <div className="p-3.5 rounded-xl bg-[var(--accent-gold-subtle)] border border-[var(--accent-gold-border)] space-y-1.5">
          <div className="flex items-center gap-1.5 text-[var(--accent-gold-text)] text-xs font-semibold">
            <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Ringkasan Eksekutif</span>
          </div>
          <p className="text-[13px] text-[var(--text-primary)] leading-relaxed">{parsed.summary}</p>
        </div>
      )}

      {parsed.sentiment && (
        <div className="surface-inset p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs">
            <span className="font-semibold text-[var(--text-secondary)]">Distribusi Sentimen</span>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-tabular">
              <span className="inline-flex items-center gap-1 text-[var(--sentiment-pos)] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[var(--sentiment-pos-bar)] shrink-0" aria-hidden="true" />
                {parsed.sentiment.posPct}% {parsed.sentiment.posCount ? `(${parsed.sentiment.posCount})` : ''}
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--text-secondary)] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[var(--sentiment-neu-bar)] shrink-0" aria-hidden="true" />
                {parsed.sentiment.neuPct}% {parsed.sentiment.neuCount ? `(${parsed.sentiment.neuCount})` : ''}
              </span>
              <span className="inline-flex items-center gap-1 text-[var(--sentiment-neg)] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[var(--sentiment-neg-bar)] shrink-0" aria-hidden="true" />
                {parsed.sentiment.negPct}% {parsed.sentiment.negCount ? `(${parsed.sentiment.negCount})` : ''}
              </span>
            </div>
          </div>

          <div className="w-full h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden flex gap-0.5">
            <div style={{ width: `${parsed.sentiment.posPct}%` }} className="h-full bg-[var(--sentiment-pos-bar)]" />
            <div style={{ width: `${parsed.sentiment.neuPct}%` }} className="h-full bg-[var(--sentiment-neu-bar)]" />
            <div style={{ width: `${parsed.sentiment.negPct}%` }} className="h-full bg-[var(--sentiment-neg-bar)]" />
          </div>
        </div>
      )}

      {parsed.highlights.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="text-xs font-semibold text-[var(--text-secondary)]">Sorotan Isu Strategis</div>

          <div className="grid grid-cols-1 gap-2">
            {parsed.highlights.map((hl, i) => {
              const isPos = hl.type === 'positive';
              const isNeg = hl.type === 'negative';
              const isPol = hl.type === 'policy';

              return (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    isPos
                      ? 'bg-[var(--sentiment-pos-subtle)] border-[var(--sentiment-pos-border)]'
                      : isNeg
                        ? 'bg-[var(--sentiment-neg-subtle)] border-[var(--sentiment-neg-border)]'
                        : isPol
                          ? 'bg-[var(--accent-gold-subtle)] border-[var(--accent-gold-border)]'
                          : 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {isPos && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--sentiment-pos)] shrink-0" aria-hidden="true" />}
                    {isNeg && <AlertTriangle className="w-3.5 h-3.5 text-[var(--sentiment-neg)] shrink-0" aria-hidden="true" />}
                    {isPol && <Scale className="w-3.5 h-3.5 text-[var(--accent-gold-text)] shrink-0" aria-hidden="true" />}
                    {!isPos && !isNeg && !isPol && (
                      <Bookmark className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    )}

                    <span
                      className={
                        isPos
                          ? 'text-[var(--sentiment-pos)]'
                          : isNeg
                            ? 'text-[var(--sentiment-neg)]'
                            : isPol
                              ? 'text-[var(--accent-gold-text)]'
                              : 'text-[var(--text-primary)]'
                      }
                    >
                      {hl.title}
                    </span>
                  </div>

                  <p className="text-[12.5px] text-[var(--text-primary)] leading-relaxed sm:pl-5 break-words">
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
