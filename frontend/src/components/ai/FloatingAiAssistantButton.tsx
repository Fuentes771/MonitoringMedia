import { MessageSquareText } from 'lucide-react';

interface FloatingAiAssistantButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function FloatingAiAssistantButton({ onClick, isOpen = false }: FloatingAiAssistantButtonProps) {
  if (isOpen) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6 z-40">
      <button
        type="button"
        onClick={onClick}
        aria-label="Buka Asisten Analis TRINETRA"
        className="btn-contrast min-h-12 px-4 md:px-5 inline-flex items-center gap-2.5 text-xs sm:text-[13px] shadow-[var(--shadow-elevated)] border border-[var(--accent-gold-border)]"
      >
        <MessageSquareText className="w-4 h-4 text-[var(--accent-gold)] shrink-0" aria-hidden="true" />
        <span>Tanya Analis AI</span>
      </button>
    </div>
  );
}
