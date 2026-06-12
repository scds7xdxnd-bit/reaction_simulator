# UI Design Standard — Reaction Simulator

**Status:** Proposed · 2026-06-13
**Evidence:** `docs/ui-audit/` (22 screenshots, see `INDEX.md`)
**Goal:** One coherent visual system. Professional engineering-tool feel (reference class: Aspen HYSYS, COMSOL, Linear, Figma), intuitive navigation, zero per-component improvisation.

---

## 1. Audit findings (what's broken today)

| # | Problem | Evidence |
|---|---------|----------|
| F1 | **Split-brain theme.** Light canvas + light toolbar, but permanently dark right panel and bottom status bar. The theme toggle barely changes anything. | `01` vs `02` |
| F2 | **Tabs disagree with each other.** Analysis tab is fully light; Levenspiel/Profiles/Dynamic/Scenarios/Design are dark — same panel, same tab row. | `14` vs `10,13,15,16` |
| F3 | **Params panel is dark, floats over light canvas.** Third theme context on one screen. | `07` |
| F4 | **13+ accent colors with no system.** Every node type and toolbar category invents its own hue (blue, amber, rose, sky, brown, teal, orange, cyan, red, indigo, violet, green, gray). | `03–06`, toolbar source |
| F5 | **Typography chaos.** Font sizes 7.5 / 8 / 9 / 10 / 11 / 12 px, uppercase micro-labels, monospace mixed in ad hoc. | all |
| F6 | **Three popover styles.** Category flyout (radius 10, shadow A), examples dropdown (radius 8, shadow B), export dropdown (radius 8, different padding). | `03`, `08`, `09` |
| F7 | **Dead space.** Right panel below the stream table is a large empty dark void. | `01`, `16` |
| F8 | **Hard-coded hex values everywhere.** No tokens; restyling requires touching every file. | source |

---

## 2. Design principles

1. **One theme at a time.** The entire app is light, or the entire app is dark — never both. Theme is a token swap, not a per-panel decision.
2. **Color = meaning, not decoration.** The canvas is where color carries information (node categories, stream states, convergence). Chrome (toolbars, panels, tabs) stays neutral so the flowsheet is the loudest thing on screen.
3. **Density with hierarchy.** This is a pro tool — compact is right — but compact must still have a clear reading order: panel title → section → control → caption.
4. **Every component appears once.** One button, one popover, one input, one table. Variants, not new components.

---

## 3. Design tokens

Implement as CSS custom properties in `src/index.css` under `:root` and `[data-theme="dark"]`. **All components consume tokens; no raw hex in TSX.**

### 3.1 Color — neutrals (chrome)

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg-app` | `#f6f7f9` | `#0e1117` | App shell behind everything |
| `--bg-surface` | `#ffffff` | `#161b22` | Panels, toolbar, cards, popovers |
| `--bg-canvas` | `#eef1f6` | `#11151c` | Flowsheet canvas |
| `--bg-inset` | `#f1f3f7` | `#0e1117` | Input wells, table header rows |
| `--bg-hover` | `#eceff4` | `#1f2630` | Hover state on list items/buttons |
| `--border` | `#dfe3ea` | `#2a313c` | All 1px borders |
| `--border-strong` | `#c3cad6` | `#3d4654` | Focused/selected outlines (with accent) |
| `--text-primary` | `#1a2233` | `#e6e9ef` | Headings, values |
| `--text-secondary` | `#5b6577` | `#9aa4b2` | Labels, captions |
| `--text-disabled` | `#a4adbd` | `#566070` | Disabled |

### 3.2 Color — accent & semantic

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--accent` | `#2563eb` | `#4f8ef7` | Primary actions, active tab, selection, focus rings |
| `--accent-soft` | `#eaf0fe` | `#1c2a45` | Selected/active backgrounds |
| `--success` | `#15803d` | `#34c46a` | Converged, pass |
| `--warn` | `#b45309` | `#e8a13c` | Partial conversion, warnings |
| `--danger` | `#b91c1c` | `#e5534b` | Failed, destructive actions |

**Rule:** the chrome uses *only* `--accent` as a non-neutral color. Success/warn/danger appear only on status content (chips, convergence badges), never decoratively.

### 3.3 Color — node categories (canvas only)

Collapse 13 hues to **4 category colors** + 1 neutral. A node's category color appears in its header strip and toolbar icon; the node body is always `--bg-surface`.

| Token | Light | Category | Members |
|-------|-------|----------|---------|
| `--cat-reactor` | `#2563eb` (blue) | Reactors | CSTR, PFR, Batch, Semibatch, FixedBed |
| `--cat-separation` | `#0d9488` (teal) | Separation/Thermal | Flash, CSplit, Purge, HX |
| `--cat-pressure` | `#7c3aed` (violet) | Pressure | Pump, Comp, Valve |
| `--cat-flow` | `#64748b` (slate) | Flow & I/O | Mixer, Splitter, Feed, Product |

Within a category, members are distinguished by **icon and label, not color**. (CSTR vs PFR shape silhouettes are already distinctive — keep them, recolor to category hue.)

### 3.4 Typography

Font stack: `Inter, -apple-system, system-ui, sans-serif`. Numeric/engineering values: `"JetBrains Mono", ui-monospace, monospace` — *only* for stream-table numbers, parameter values, and units.

| Token | Size/weight | Use |
|-------|------------|-----|
| `--type-title` | 13px / 600 | Panel titles ("STREAM TABLE" → "Stream Table", sentence case) |
| `--type-body` | 12.5px / 400 | Default text, list items |
| `--type-label` | 11px / 500 | Form labels, table headers |
| `--type-caption` | 10.5px / 400 | Hints, units, secondary metadata |
| `--type-micro` | 9px / 600 / +0.06em / uppercase | **Only** toolbar category labels and node badges. Nothing else may be uppercase. |

**Kill all font sizes below 9px.** The current 7.5/8px labels fail readability.

### 3.5 Geometry

| Token | Value | Use |
|-------|-------|-----|
| `--radius-sm` | 6px | Inputs, buttons, chips |
| `--radius-md` | 8px | Cards, popovers, node bodies |
| `--radius-lg` | 12px | Modals |
| `--space-unit` | 4px | All spacing = multiples of 4 (4/8/12/16/24) |
| `--shadow-popover` | `0 4px 16px rgba(15,23,42,.10), 0 1px 3px rgba(15,23,42,.08)` | All floating surfaces (one shadow, period) |
| `--shadow-modal` | `0 16px 48px rgba(15,23,42,.18)` | Modals only |

### 3.6 Z-index scale

`canvas:0 · nodes:10 · panels:50 · popovers:200 · tooltips:300 · modals:400 · toasts:500`. No other values allowed.

---

## 4. Layout architecture

Keep the current 4-zone shell — it's the right structure. Fix the zones' internals.

```
┌──────┬──────────────────────────────┬───────────────────┐
│      │  Top bar (mode, kinetics)    │                   │
│ Left │──────────────────────────────│   Right panel     │
│ rail │                              │  ┌─ Tab row ────┐ │
│      │        Canvas                │  │ Plot area    │ │
│ 64px │      (flowsheet)             │  ├──────────────┤ │
│      │                              │  │ Stream table │ │
│      │                              │  └──────────────┘ │
├──────┴──────────────────────────────┴───────────────────┤
│  Status bar (results summary · mode toggles)            │
└──────────────────────────────────────────────────────────┘
```

### 4.1 Left rail
- Width 64px, `--bg-surface`, right border `--border`.
- Top section: 4 category triggers (icon + `--type-micro` label). Icons monochrome `--text-secondary`; on hover/open the icon and label adopt the category color and a `--accent-soft`-style tinted background. **No colored borders around idle icons.**
- Flyouts: the standard Popover (§5.3), opening right, with the existing hover-bridge. Grid of node items, each = icon (category hue) + label.
- Bottom section: Export / Examples / Load / Params / Save as uniform icon buttons (§5.1, ghost variant). Same popover component for Export and Examples menus.

### 4.2 Top bar
- Height 48px, `--bg-surface`, bottom border. Contains the global mode and kinetics selects (standard Select, §5.4) and nothing else. Left-align after the rail; no floating cards.

### 4.3 Canvas
- `--bg-canvas` with a subtle 20px dot grid (`--border` at 40% opacity).
- Node anatomy (one component, all types):
  - **Header strip:** 24px, category-color background at 12% tint, contains category badge (`--type-micro`, category color), node name (`--type-body`, 600), and key metric right-aligned (`--type-caption`, mono).
  - **Body:** `--bg-surface`, radius `--radius-md`, border `--border`; selected = 1.5px `--accent` border + soft outer glow. Inputs inside follow §5.4.
  - **Conversion bar:** keep, recolor to a single neutral track + `--accent` fill; the gradient-per-node rainbow goes away.
  - **Handles:** 8px circles, `--text-secondary` idle, `--accent` on hover/connect. Not per-node colors.
- Feed/Product remain circles but adopt `--cat-flow` styling.

### 4.4 Right panel
- Width 420px (resizable later), `--bg-surface`, left border.
- **Tab row:** the 7 tabs are too many for one flat row and they hide the panel's structure. Regroup into 4 tabs with internal sub-views:
  - **Results** (Levenspiel · Profiles · Thermal) — segmented control inside
  - **Dynamic**
  - **Analysis** (Sweep · Target · Compare — keep its existing sub-tabs)
  - **Design** (Specs · Scenarios)
- Tab style: text `--text-secondary`, active = `--text-primary` + 2px `--accent` underline. No filled tabs.
- **Stream table** is permanent, docked at the panel bottom (its own collapsible section, default open), independent of the active tab — it's the single most-referenced artifact and currently vanishes when switching tabs.
- Empty states: icon + one sentence + one action button, centered, `--text-secondary`. (Design/Scenarios already do this — standardize the styling.)

### 4.5 Status bar
- Height 36px, `--bg-surface`, top border (no longer dark-on-light).
- Left: results summary (Final Xₐ, k, Cₐ₀) as label/value pairs — labels `--text-secondary`, values mono `--text-primary`; convergence chip uses semantic colors.
- Right: theme toggle + Sizing/Steady-State/Dynamic as a segmented control (§5.2).

---

## 5. Component standards

### 5.1 Buttons
| Variant | Style | Use |
|---------|-------|-----|
| Primary | `--accent` bg, white text | One per surface max (Run Sweep, Save, Next) |
| Secondary | `--bg-surface`, `--border`, `--text-primary` | Everything else |
| Ghost | transparent, `--text-secondary`; hover `--bg-hover` | Icon buttons, toolbar actions |
| Danger | `--danger` text, ghost; filled only in confirmations | Delete |

Height 28px (compact) / 32px (default). Radius `--radius-sm`. Focus: 2px `--accent` ring at 40% opacity.

### 5.2 Segmented control
For mutually-exclusive small sets (Steady/Dynamic, Xₐ(t)/G(t), plot sub-views): `--bg-inset` track, active segment `--bg-surface` + shadow-sm + `--text-primary`. Replaces the current loose button clusters.

### 5.3 Popover (one component)
`--bg-surface`, `--border`, `--radius-md`, `--shadow-popover`, padding 8px, `z:200`. Used by: toolbar flyouts, Examples, Export, context menus, type-ahead results. Menu items: 28px row, `--type-body`, hover `--bg-hover`, radius `--radius-sm`.

### 5.4 Inputs & selects
Height 28px, `--bg-inset` well, `--border`, radius `--radius-sm`; focus = `--accent` border + ring. Label above in `--type-label`; unit suffix inside the well, right-aligned, mono `--text-secondary`. Replaces native `<select>` styling drift between panels.

### 5.5 Tables (stream table)
- Header row: `--bg-inset`, `--type-label`, sentence case.
- Numeric cells: mono, right-aligned. Stream IDs: mono, 600.
- Status values (Xₐ%): chip with semantic color at 12% tint bg — keep current idea, standardize the chip component.
- Row hover: `--bg-hover`; row click selects the corresponding edge on canvas (cross-highlighting — see §6).

### 5.6 Modals
Centered, `--radius-lg`, `--shadow-modal`, max-width 560px, scrim `rgba(15,23,42,.4)`. Title row + body + right-aligned footer actions. Reaction Builder adopts this.

### 5.7 Tooltips
Dark tooltip in both themes (`#1a2233` bg, white text, 11px, radius `--radius-sm`, `z:300`), 300ms delay. Already close — standardize delay and style.

---

## 6. Navigation & interaction standards

1. **Selection is the hub.** Click node → node gets accent border *and* right panel shows a **node inspector** header (name, category, key params) above the active tab content. Today selection has no echo outside the canvas.
2. **Cross-highlighting.** Hover a stream-table row ↔ highlight that edge; hover a Levenspiel segment ↔ highlight that reactor. Cheap to build, huge for intuition.
3. **Hover-intent everywhere.** The flyout bridge pattern (already implemented) is the standard for any hover-opened surface.
4. **Escape always closes** the topmost layer (popover → modal → deselect), in that order.
5. **Empty states teach.** Every empty surface states what it is, why it's empty, and the one action that fills it.
6. **Keyboard:** `Del` removes selection, `Cmd+S` save, `Cmd+O` load, `Cmd+E` export, `1–4` switch right-panel tabs. Document in a `?` shortcut sheet.

---

## 7. Theme strategy

- **Default: light.** It matches the engineering-tool reference class and the existing canvas/node investment.
- Dark is a full `[data-theme="dark"]` token swap — *every* token has a dark value (§3). The current half-dark panels are retired; the toggle in the status bar switches the whole app or nothing.
- Plots read their colors from tokens (axis = `--text-secondary`, grid = `--border`, series 1 = `--accent`, series 2 = `--cat-separation`, series 3 = `--warn`) so they flip with the theme automatically.

---

## 8. Migration plan (each phase ships independently)

| Phase | Scope | Touches |
|-------|-------|---------|
| **M1 — Tokens** | Add CSS variables to `index.css`; no visual change yet. | 1 file |
| **M2 — Unify the shell** | Right panel + status bar + Params panel to light theme via tokens; fix F1/F2/F3. Biggest visible win. | panel components |
| **M3 — Primitives** | Button/Popover/Input/Select/Chip/SegmentedControl in `src/components/ui/`; migrate toolbar + flyouts + Export/Examples menus. Fixes F6. | ui/ + toolbar |
| **M4 — Node system** | 4-category palette, unified node anatomy, neutral handles. Fixes F4. | node components |
| **M5 — Right panel IA** | 4-tab regroup, docked stream table, node inspector, empty states. Fixes F7. | panel layout |
| **M6 — Polish** | Cross-highlighting, keyboard map, true dark mode QA. | interaction layer |

**Definition of done per phase:** zero raw hex in touched files; all type sizes from §3.4; re-run `node scripts/ui-audit.mjs` and diff against `docs/ui-audit/` baselines.

---

## 9. Hard rules (lint-able)

1. No hex colors in TSX — tokens only.
2. No font size below 9px; no uppercase outside `--type-micro` contexts.
3. No new z-index values outside §3.6.
4. No inline `boxShadow` — the two shadow tokens only.
5. One primary button per visible surface.
6. Any floating surface = the §5.3 Popover.
