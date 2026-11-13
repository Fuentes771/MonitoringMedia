import { useState } from 'react';
import { Sparkles, Bot } from 'lucide-react';

interface FloatingAiAssistantButtonProps {
  onClick: () => void;
  isOpen?: boolean;
}

export function FloatingAiAssistantButton({ onClick, isOpen = false }: FloatingAiAssistantButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  if (isOpen) {
    return null; // Hide button when drawer is currently open
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
      {/* Tooltip / Pill on Hover */}
      <div
        className={`transition-all duration-300 ease-out origin-right transform ${
          isHovered ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-95 translate-x-2 pointer-events-none'
        }`}
      >
        <div className="px-3.5 py-1.5 rounded-full bg-[#0e1117]/95 border border-amber-500/35 text-xs font-semibold text-amber-200 shadow-lg shadow-black/60 backdrop-blur-md flex items-center gap-2 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          <span>Tanya Asisten AI Intelijen</span>
        </div>
      </div>

      {/* Sleek Floating Orb Trigger */}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-zinc-200 text-zinc-950 shadow-[0_4px_20px_rgba(212,175,55,0.28)] hover:shadow-[0_6px_26px_rgba(212,175,55,0.45)] hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-[#08090d] cursor-pointer"
        aria-label="Buka Asisten AI TRINETRA"
      >
        {/* Subtle metallic gold halo ring */}
        <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-amber-500/50 via-zinc-300/30 to-amber-600/50 opacity-45 blur-sm group-hover:opacity-80 transition duration-500 group-hover:duration-200" />

        {/* Inner obsidian surface */}
        <div className="relative flex items-center justify-center w-full h-full rounded-full bg-[#0e1117] border border-amber-400/50 group-hover:border-amber-300 transition-colors overflow-hidden">
          {/* Subtle gold sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/15 via-transparent to-zinc-200/10 opacity-70 group-hover:opacity-100 transition-opacity" />

          {/* Icon */}
          <div className="relative flex items-center justify-center">
            <Bot className="w-6 h-6 text-amber-300 group-hover:scale-110 transition-transform duration-300" />
            <Sparkles className="w-3.5 h-3.5 text-zinc-100 absolute -top-1.5 -right-1.5 animate-spin transition-transform duration-1000" style={{ animationDuration: '6s' }} />
          </div>

          {/* Active status pip */}
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0e1117] shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
        </div>
      </button>
    </div>
  );
}

