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
        <div className="px-3.5 py-1.5 rounded-full bg-zinc-900/95 border border-cyan-500/30 text-xs font-semibold text-cyan-200 shadow-xl shadow-cyan-950/50 backdrop-blur-md flex items-center gap-2 whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          <span>Tanya Asisten AI Intelijen</span>
        </div>
      </div>

      {/* Sleek Floating Orb Trigger */}
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white shadow-[0_0_25px_rgba(6,182,212,0.45)] hover:shadow-[0_0_35px_rgba(6,182,212,0.7)] hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-[#08090d] cursor-pointer"
        aria-label="Buka Asisten AI PulseScope"
      >
        {/* Animated glowing backdrop ring */}
        <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 opacity-60 blur-md group-hover:opacity-100 transition duration-500 group-hover:duration-200 animate-pulse" />

        {/* Inner button surface */}
        <div className="relative flex items-center justify-center w-full h-full rounded-full bg-[#0a0f1d] border border-cyan-400/40 group-hover:border-cyan-300 transition-colors overflow-hidden">
          {/* Subtle gradient sheen */}
          <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-transparent to-blue-500/30 opacity-70 group-hover:opacity-100 transition-opacity" />

          {/* Icon */}
          <div className="relative flex items-center justify-center">
            <Bot className="w-6 h-6 text-cyan-300 group-hover:scale-110 transition-transform duration-300" />
            <Sparkles className="w-3.5 h-3.5 text-amber-300 absolute -top-1.5 -right-1.5 animate-spin transition-transform duration-1000" style={{ animationDuration: '6s' }} />
          </div>

          {/* Active status pip */}
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0a0f1d] shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
        </div>
      </button>
    </div>
  );
}

