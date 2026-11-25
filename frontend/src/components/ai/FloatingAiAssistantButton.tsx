import { useState } from 'react';
import { Sparkles, Bot } from 'lucide-react';

interface FloatingAiAssistantButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function FloatingAiAssistantButton({ onClick, isOpen = false }: FloatingAiAssistantButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (isOpen) {
    return null;
  }

  return (
    <div className="fixed right-3.5 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6 md:right-6 z-40 flex items-center gap-3">
      {/* Desktop Hover Pill */}
      <div
        className={`hidden md:block transition-all duration-200 ease-out origin-right transform motion-reduce:transition-none ${
          isHovered ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 translate-x-2 pointer-events-none'
        }`}
      >
        <div className="px-3.5 py-1.5 rounded-full bg-[#0e1117]/95 border border-amber-500/35 text-xs font-semibold text-amber-200 shadow-lg shadow-black/60 backdrop-blur-md flex items-center gap-2 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>Tanya Asisten AI Intelijen</span>
        </div>
      </div>

      {/* Mobile Labeled Pill / Desktop Circular Orb Trigger */}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex items-center justify-center min-h-12 px-3.5 md:px-0 md:w-14 md:h-14 rounded-full bg-[#0e1117] border border-amber-400/55 hover:border-amber-300 text-amber-200 shadow-[0_6px_24px_rgba(0,0,0,0.65),0_0_18px_rgba(212,175,55,0.22)] hover:shadow-[0_8px_28px_rgba(212,175,55,0.38)] active:scale-95 transition-all duration-200 motion-reduce:transition-none cursor-pointer"
        aria-label="Buka Asisten AI TRINETRA"
      >
        <span className="relative flex items-center gap-2">
          <span className="relative flex items-center justify-center">
            <Bot className="w-5 h-5 md:w-6 md:h-6 text-amber-300" aria-hidden="true" />
            <Sparkles className="w-3 h-3 text-zinc-100 absolute -top-1 -right-1.5" aria-hidden="true" />
          </span>
          <span className="md:hidden text-xs font-bold tracking-wide text-amber-200">
            Tanya AI
          </span>
        </span>

        {/* Active status indicator */}
        <span
          aria-hidden="true"
          className="hidden md:block absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0e1117]"
        />
      </button>
    </div>
  );
}
