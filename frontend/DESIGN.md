# TRINETRA Design System & Direction Contract

> **Design Read:** Executive public-discourse intelligence console for Indonesian analysts and leadership, in a warm matte obsidian and warm alabaster precision-editorial language (Hybrid Editorial Warm Obsidian & Split-Contrast Precision).
> **Dial:** ENERGY 2 / RHYTHM 2 / MOTION 2

---

## 1. Visual Identity & Core Principles

1. **Warm Matte Obsidian (Dark Default) & Warm Alabaster Paper (Light Toggle):**
   - Avoid cold blue-black AI defaults (`#08090d`) and sterile stark white.
   - Dark mode uses warm stone-obsidian surfaces (`#141311`, `#1D1B19`, `#262320`) with warm ivory ink (`#F5F2EC`) for extended analytical reading comfort.
   - Light mode uses warm architectural alabaster (`#F6F3EE`) with crisp white data sheets (`#FFFFFF`) and deep espresso-ink text (`#181614`) for maximum table/evidence legibility.
2. **One Deliberate Accent (Sovereign Gold):**
   - Rooted directly in TRINETRA's official gold eye emblem (`/brand/trinetra-logo.svg`).
   - Used sparingly at key focal points: active navigation indicator, primary focal highlight, chart active series/peak, and focus rings.
   - Semantic colors (emerald positive, rose negative, stone neutral) are reserved strictly for sentiment data and genuine alert/threat states.
3. **One Focal Point Per Screen:**
   - Every view opens with a clear primary focal anchor (e.g., Split Executive Hero on `OverviewPage`, Master-Detail Evidence Split on `MentionsPage`).
   - Avoid multi-level nested borders (never stack 3-4 boxes inside each other).
4. **Honest Data & Honest UI:**
   - All metrics, charts, and feeds bind exclusively to live backend API responses or explicit empty/loading/error states explaining cause and next action.
   - Zero em dashes in UI prose, zero decorative emoji, zero generic `Sparkles` icon spam, and zero decorative uppercase monospace eyebrows.

---

## 2. Verified WCAG AA Color Palette

All pairings verified mathematically via WCAG 2.x luminance formula (`>= 4.5:1` normal text, `>= 3.0:1` large text & UI boundaries):

### Dark Mode (`.dark`, default)
- `--bg-canvas`: `#141311`
- `--bg-rail`: `#0E0D0C`
- `--bg-surface`: `#1D1B19`
- `--bg-surface-elevated`: `#262320`
- `--bg-hero-tint`: `#28221B`
- `--text-primary`: `#F5F2EC` (15.37:1 on surface, 16.62:1 on canvas)
- `--text-secondary`: `#B8B2A6` (8.14:1 on surface)
- `--text-muted`: `#A39D90` (5.79:1 on elevated)
- `--border-subtle`: `rgba(245, 242, 236, 0.08)`
- `--border-medium`: `rgba(245, 242, 236, 0.16)`
- `--border-input`: `#736D64` (> 3.3:1 non-text contrast on surface)
- `--accent-gold`: `#DFB84F` (with `#141311` ink: 9.82:1)
- `--accent-gold-text`: `#E2BE5B` (9.61:1 on surface)
- `--action-contrast-bg`: `#F5F2EC` / `--action-contrast-fg`: `#141311` (16.62:1)
- `--sentiment-pos`: `#34D399` (8.93:1 on surface)
- `--sentiment-neg`: `#FB7185` (6.38:1 on surface)
- `--sentiment-neu`: `#A8A29E`

### Light Mode (`:root` / `.light`)
- `--bg-canvas`: `#F6F3EE`
- `--bg-rail`: `#EFEAE2`
- `--bg-surface`: `#FFFFFF`
- `--bg-surface-elevated`: `#F0ECE4`
- `--bg-hero-tint`: `#FAF6EE`
- `--text-primary`: `#181614` (18.05:1 on white, 16.30:1 on canvas)
- `--text-secondary`: `#57524A` (7.75:1 on white, 6.47:1 on rail)
- `--text-muted`: `#666057` (6.22:1 on white, 5.28:1 on inset)
- `--border-subtle`: `rgba(24, 22, 20, 0.09)`
- `--border-medium`: `rgba(24, 22, 20, 0.18)`
- `--border-input`: `#8A8277` (3.79:1 non-text contrast on white)
- `--accent-gold`: `#DFB84F` (with `#181614` ink: 9.54:1)
- `--accent-gold-text`: `#7A5B0E` (5.35:1 on inset, > 6.1:1 on white)
- `--action-contrast-bg`: `#1B1917` / `--action-contrast-fg`: `#F5F2EC` (15.69:1)
- `--sentiment-pos`: `#047857` (5.48:1 on white)
- `--sentiment-neg`: `#BE123C` (6.29:1 on white)
- `--sentiment-neu`: `#57524A`

---

## 3. Typography & Radius Hierarchy

- **UI & Analytics Numerals:** `Plus Jakarta Sans` with `font-variant-numeric: tabular-nums` on all KPI numbers, counters, and percentages.
- **Editorial Display Headings:** `Newsreader` reserved for page titles, hero synthesis headline, and major analytical panel titles.
- **Monospace (`JetBrains Mono`):** Reserved strictly for technical identifiers (`#42`), keyboard shortcuts (`Ctrl+K`), timestamps, and API/connector diagnostics. Never used for decorative uppercase eyebrows.
- **Radius Scale:**
  - `24px` (`rounded-3xl`): Primary workspace cards and hero panels.
  - `16px` (`rounded-2xl`): Integrated KPI docks, interactive pill rows, modal containers.
  - `12px` (`rounded-xl`): Form inputs, icon buttons, dropdowns.
  - `8px` (`rounded-lg`): Functional data/status badges.
  - `9999px` (`rounded-full`): Primary contrast CTA buttons and segmented period pills only.

---

## 4. Dose Caps & Motion Rules

- **Glassmorphism (R-10):** Limited strictly to the sticky `Topbar` and modal/drawer backdrops. Cards, sidebar rail, and inputs stay matte and opaque.
- **Glow (R-13):** Limited strictly to the warm ambient highlight inside the primary Hero card and the Login seal.
- **Motion (Dial 2, R-19, R-39):** Clean state transitions (`150ms` - `220ms ease-out`), rail width expansion, and subtle entrance transition on page mount. Zero infinite pulsing/bouncing loops or running marquee tickers. Respects `prefers-reduced-motion: reduce`.
