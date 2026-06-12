# Reaction Simulator — Feature Proposals & Design Spec

> **Status:** Phase 8 in progress — F10.1, F11.1, F11.2, F12.1, F13.1, F13.2, F14.1–F14.5, F15.1, F16, F17, F18 implemented.  
> **Source:** User feedback + screenshot review, 2026-06-11. Part II added 2026-06-11
> (second pass): professional-grade direction for chemical engineers, process designers,
> and P&ID makers. Part III added 2026-06-11 (third pass): Blender-inspired UI/UX refinements.  
> Feature numbers in Part I match the original feedback list. Sections 4–6 are grounded
> in the exact screenshots provided. Part II continues the numbering (10–24). Part III: 25–34.

---

## Table of Contents

**Part I — UX & Chemistry Authoring (original feedback pass)**

1. [Species-Aware Feed Nodes](#1-species-aware-feed-nodes)
2. [Reactors Accept Multiple Feed Sources (Mixing)](#2-reactors-accept-multiple-feed-sources-mixing)
3. [Automatic N-Way Flow Splitting on Any Edge](#3-automatic-n-way-flow-splitting-on-any-edge)
4. [Consolidate All Parameters into the Popover Window](#4-consolidate-all-parameters-into-the-popover-window)
5. [Visual Reaction Mode Selector — Icon Cards](#5-visual-reaction-mode-selector--icon-cards)
6. [Text-Based Reaction Builder — Type the Equation](#6-text-based-reaction-builder--type-the-equation)
7. [Reaction Fires When Required Species Meet at a Reactor](#7-reaction-fires-when-required-species-meet-at-a-reactor)
8. [Preset Reactions Are Editable](#8-preset-reactions-are-editable)
9. [Ctrl+Drag Chain-Connect](#9-ctrldrag-chain-connect)

**Part II — Professional-Grade Direction (second pass)**

- *II-A Engineering Foundations*
  10. [Units System — Quantity Layer](#10-units-system--quantity-layer)
  11. [Species Database & Real Thermochemistry](#11-species-database--real-thermochemistry)
  12. [Stream as Primary Currency (Phase B Refactor, Promoted)](#12-stream-as-primary-currency)
  13. [Solver Robustness — Wegstein, Newton Tears, Adaptive ODE](#13-solver-robustness)
- *II-B Flowsheet Completeness*
  14. [New Unit Operations — HX, Flash, Component Splitter, Pump/Compressor/Valve, Purge](#14-new-unit-operations)
  15. [Design Specs — Generalised Inverse Solving](#15-design-specs--generalised-inverse-solving)
  16. [Recycle-with-Purge Template & Inert Tracking](#16-recycle-with-purge-template)
- *II-C Energy, Safety & Non-Ideality*
  17. [Detailed Heat Exchange — UA, Coolant Balance, Co/Counter-Current](#17-detailed-heat-exchange)
  18. [Safety & Stability Analysis — ΔT_ad, Runaway, Ignition–Extinction](#18-safety--stability-analysis)
  19. [Non-Ideal Flow & Catalyst Effects — Dispersion, Effectiveness, Deactivation](#19-non-ideal-flow--catalyst-effects)
- *II-D Professional Deliverables*
  20. [Engineering Stream Table & Heat-and-Material Balance Report](#20-engineering-stream-table--hmb-report)
  21. [P&ID / PFD Mode — ISA-5.1 Symbols, Tags, Title Block, Export](#21-pid--pfd-mode)
  22. [Equipment Sizing & Cost Estimation](#22-equipment-sizing--cost-estimation)
  23. [Optimisation Engine](#23-optimisation-engine)
  24. [Interoperability — Kinetics & Flowsheet Import/Export](#24-interoperability)
- [Amendments to Architectural Invariants](#amendments-to-architectural-invariants)
- [Cross-Feature Interaction Map](#cross-feature-interaction-map)
- [Suggested Implementation Order](#suggested-implementation-order)

**Part III — UI/UX Refinements (Blender-Inspired)**

  25. [Context Menu: Single-Click Open, Click-Away Close](#25-context-menu-single-click-open-click-away-close)
  26. [Params Accordion: No Layout Jump on Toggle](#26-params-accordion-no-layout-jump-on-toggle)
  27. [Params Panel: Vertical Scroll to Fit Reaction Builder Modal](#27-params-panel-vertical-scroll-to-fit-reaction-builder-modal)
  28. [Resizable Layout Partitions](#28-resizable-layout-partitions)
  29. [Stream Table: Full Right-Column Height](#29-stream-table-full-right-column-height)
  30. [Fix: Reactor Node Cursor Sticking on Mode Select](#30-fix-reactor-node-cursor-sticking-on-mode-select)
  31. [Remove Redundant Mode/Kinetics Dropdown Bar](#31-remove-redundant-modekinetics-dropdown-bar)
  32. [Reactor Node Label: "name | Da" Format with Editable Name](#32-reactor-node-label-name--da-format-with-editable-name)
  33. [Relocate Save/Load/Examples/Export to Canvas Top Toolbar](#33-relocate-saveloadexamplesexport-to-canvas-top-toolbar)
  34. [Blender-Inspired Overall Layout & UX](#34-blender-inspired-overall-layout--ux)

---

## 1. Species-Aware Feed Nodes

### Current behaviour

A Feed node is generic — it holds an optional `Ca0` override, `T_feed`, and `flowrate`.
It has no concept of *which chemical species* it carries. For a bimolecular reaction
A + B → R there is no way to represent "this pipe is A, that pipe is B."

### Proposed behaviour

Each Feed node is assigned a **species label** — a short symbol like `A`, `B`, `O₂`, or
`Glucose`. The label is the identity token: it matches species labels used in the
reaction equation and rate law. The node stores:

```
FeedData {
  speciesLabel:  string   // "A", "B", "Methanol" — the chemical species this pipe carries
  concentration: number   // mol/L — replaces global Ca0 when set per-feed
  T_feed:        number   // K
  flowrate:      number   // normalised volumetric flow, default 1.0
  label?:        string   // optional display-only override e.g. "Ethylene Feed"
}
```

#### Defaults when placed

- First Feed placed → `speciesLabel = "A"` (auto-assigned)
- Second Feed placed → `speciesLabel = "B"`, and so on alphabetically
- User can rename the label at any time by clicking the symbol on the node

#### Visual design

The species label is displayed as the primary visual element on the Feed circle:

```
  ╭────────╮
  │   [A]  │   ← large, bold, coloured in species accent colour
  │ 1.0 M  │   ← concentration
  │ 300 K  │   ← temperature
  ╰────────╯
```

Each unique species label gets a consistent accent colour across the whole canvas
(A = blue, B = green, R = amber, S = red, T = purple, U = orange) so users can visually
trace species through the network even in complex topologies.

#### Serialiser

`serializer.ts` migration map gains a v2 entry that adds `speciesLabel: "A"` to any
legacy Feed nodes that lack it.

---

## 2. Reactors Accept Multiple Feed Sources (Mixing)

### Current behaviour

`getInletStream()` in `networkSolver.ts` picks only the **first** incoming edge when a
reactor has multiple incoming connections. A second feed pipe is silently discarded.

```typescript
// networkSolver.ts — current (wrong for multi-feed)
const inlet = getInletStream(inEdges, streams, params);
```

### Proposed behaviour

Replace every `getInletStream` call on reactor nodes with `mixStreams`, which already
exists and does correct flow-weighted averaging:

```typescript
// networkSolver.ts — after change
const inlet = mixStreams(inEdges, streams, params);
```

`mixStreams` handles zero-inlet fall-back correctly (returns fresh feed defaults) so no
extra guard is needed. This is a one-line fix per reactor branch in `forwardPass`.

#### What happens at the CSTR in a two-feed setup

Feed-A (1.0 mol/L A, flow=1) and Feed-B (1.0 mol/L B, flow=1) both connect to a CSTR:

```
Ca_mix = (FA_A + FA_B) / total_vol_flow

Mole balance for species A in the inlet:
  FA0 = (1.0 mol/L × 1 L/s) = 1.0 mol/s from Feed-A
  FB0 = (1.0 mol/L × 1 L/s) = 1.0 mol/s from Feed-B
  Total flow = 2.0 L/s

  Ca_mix = 1.0/2.0 = 0.5 mol/L
  Cb_mix = 1.0/2.0 = 0.5 mol/L
  T_mix  = (1.0×300 + 1.0×300) / 2.0 = 300 K  (flow-weighted)
```

This mixed stream is then fed into `cstrModel`, which applies whichever rate law is
active. For a bimolecular A + B → R rate (series-parallel preset), both Ca_mix and
Cb_mix are used in the rate calculation automatically.

#### Phase B — promote `Stream` to primary currency (future)

Currently `StreamState` is the internal representation in `networkSolver.ts`. It only
has four concentration slots (Ca, Cr, Cs, flow). For fully arbitrary species sets this
needs to become the `Stream` type (molar-flow `Record<SpeciesId, number>`).

Proposed phased approach:
- **Phase A (immediate):** Use `mixStreams` for reactor inlets. Correct for all existing
  species sets {A, R, S, B, T, U}.
- **Phase B (full refactor):** Replace `StreamState` throughout `networkSolver.ts` with
  `Stream`. `streamBridge.ts` conversions only happen at Feed entry and Product exit.

---

## 3. Automatic N-Way Flow Splitting on Any Edge

### Current behaviour

If a reactor has two outgoing edges, both carry **full flow** — the solver duplicates
the flow, not splits it. Users are expected to insert an explicit Splitter node to divide
a stream. This surprises new users and breaks the mass balance unless a Splitter is used.

### Proposed behaviour

For all non-Splitter nodes: if N > 1 edges leave the same node, each carries `1/N` of
the outlet flow.

```typescript
// forwardPass, after outState is computed for a non-splitter node:
const outEdges = outgoingEdges.get(nodeId) ?? [];
const N = outEdges.length;
for (const e of outEdges) {
  streams.set(e.id,
    N > 1 ? { ...outState, flow: outState.flow / N } : outState
  );
}
```

#### When to use a Splitter node (unchanged)

The explicit **Splitter** node remains for **unequal splits** (set by the `α` slider).
Automatic equal-split only applies when no Splitter is present on the outgoing path.

#### Visual feedback

When a node has N > 1 outgoing edges, a small fraction label appears on each edge
near the source:

- 2 edges → each shows `½`
- 3 edges → each shows `⅓`
- N edges → each shows `1/N`

The label appears as a small chip on the edge path, not on the node itself.
If N = 1 (no split), no label is shown (no change from current behaviour).

#### Recycle interaction

Tear edges carry their fractional flow through the recycle loop. The successive-
substitution solver converges on fractional values correctly since `flow` is just
a scalar multiplier on concentrations.

---

## 4. Consolidate All Parameters into the Popover Window

### What is currently happening (from Screenshot 1)

Clicking the Params trigger opens **two simultaneous UI elements**:

**Element A — the ParameterPanel inline body** (the expandable section above the canvas,
inside the toolbar bar):
```
FEED CONDITIONS
  Ca₀  [1    ] mol/L
  T feed [300  ] K

KINETICS
  k₁   [0.5  ] s⁻¹
  k₂   [0.3  ] s⁻¹

THERMODYNAMICS
  Ea   [0    ] kJ/mol
  ΔH   [−50  ] kJ/mol
  ρCp  [4.18 ] kJ/(L·K)
```

**Element B — the ParameterPopover floating window** (the small panel that appears):
```
┌ PARAMETERS   ×  ┐
│ ▾ KINETICS       │
│   Ea [0] kJ/mol  │
│ ▾ FEED           │
│   T_feed [300] K │
│ ▾ THERMAL        │
│   ΔH [−50]       │
│   ρCp [4.18]     │
│   T_ref [300]    │
└──────────────────┘
```

**Problems:** The user has to look in two places. Ca₀, k₁, k₂ are only in Element A.
Ea is duplicated in both. The inline body pushes the canvas down when open.

### Proposed change

**Delete Element A** (the inline body that drops down inside the ParameterPanel bar).
The always-visible toolbar row (MODE dropdown + KINETICS dropdown + equation display +
Edit Reaction button) stays as-is in the toolbar — only the expandable params body is
removed.

**Expand Element B** (the popover) to contain *every* parameter that was spread across
both panels. The popover becomes the single source of truth for all global parameters.

#### New popover content (top to bottom)

```
┌─ PARAMETERS  ──────────────────────────────── × ─┐
│                                                    │
│  ▾ REACTION                                        │
│    [Mode icon cards — see Feature 5]               │
│    [Kinetics chip row — single mode only]          │
│                                                    │
│  ▾ FEED CONDITIONS                                 │
│    Ca₀        [1.0  ]  mol/L                       │
│    C_B₀       [1.0  ]  mol/L    ← series-parallel │
│    T_feed     [300  ]  K                           │
│    ε          [0    ]  —         ← gas-phase only  │
│    Cr₀/Ca₀   [0.01 ]  —         ← autocatalytic   │
│                                                    │
│  ▾ KINETICS                                        │
│    k₁         [0.5  ]  s⁻¹                        │
│    k₂         [0.3  ]  s⁻¹      ← multi-rxn only  │
│    k₃         [0.1  ]  s⁻¹      ← series3/Denbigh │
│    k₄         [0.1  ]  s⁻¹      ← Denbigh only    │
│    Keq,ref    [4.0  ]  —         ← reversible only │
│    Ea         [0    ]  kJ/mol                      │
│                                                    │
│  ▾ THERMODYNAMICS                                  │
│    ΔH         [−50  ]  kJ/mol                      │
│    ρCp        [4.18 ]  kJ/(L·K)                   │
│    T_ref      [300  ]  K                           │
│                                                    │
└────────────────────────────────────────────────────┘
```

Each section is an accordion (▾ collapses/expands), matching the existing popover
accordion behaviour already implemented via `openSections` state.

#### Popover sizing

- Width: **340 px** (up from current ~220 px, needed for the mode card grid)
- Max-height: `calc(100vh − 120px)` with `overflow-y: auto`
- Position: anchored below the Params trigger button; shifted left if it would overflow
  the right viewport edge

#### Files changed

| File | Change |
|------|--------|
| `src/App.tsx` | Remove `<ParameterPanel />` from the layout |
| `src/components/controls/ParameterPanel.tsx` | Delete file (or gut to only the toolbar row, keeping MODE / KINETICS dropdowns + Edit Reaction button) |
| `src/components/controls/ParameterPopover.tsx` | Add REACTION, FEED, KINETICS, THERMAL sections with all fields |
| `src/schema/parameterSchema.ts` | No change — PARAM_SECTIONS already has all field defs; popover can import and render them |

---

## 5. Visual Reaction Mode Selector — Icon Cards

### Current behaviour (from Screenshot 2)

The MODE selector is a hover-triggered text dropdown with these options:

```
Single
Series A→R→S
A→R→S→T
A+B→R+B→S
Denbigh
Parallel A→R/A→S
Custom...
```

Plain text with no visual hint of the reaction structure.

### Proposed behaviour

Replace the dropdown with a **grid of icon cards** inside the REACTION accordion of
the popover (Feature 4). Each card has a mini SVG diagram and a name.

#### Card grid layout (2 columns inside 340 px popover)

```
┌──────────────────┐  ┌──────────────────┐
│  A ——→ R         │  │  A ——→ R ——→ S    │
│                  │  │                  │
│   Single         │  │   Series         │
└──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐
│  A ——→ R         │  │  A ——→ R ——→ S   │
│  A ——→ S         │  │           ——→ T  │
│   Parallel       │  │   3-Step Series  │
└──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐
│  A ⇌ R           │  │  A+B ——→ R       │
│  (reversible)    │  │  R+B ——→ S       │
│   Reversible     │  │   Bimolecular    │
└──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐
│  A ——→ R ——→ S   │  │                  │
│  A ——→ T         │  │  + Custom        │
│  R ——→ U         │  │  (opens builder) │
│   Denbigh        │  │                  │
└──────────────────┘  └──────────────────┘
```

#### Card spec

Each card is a `<button role="radio">` styled as:
- 148 px wide × 76 px tall
- White background, `border-radius: 6px`, `border: 1.5px solid #e2e8f0`
- **Selected state:** `border: 2px solid #2563eb`, light-blue tint (`#eff6ff`) background
- **Hover state:** `box-shadow: 0 2px 8px rgba(0,0,0,0.10)`, slight lift
- SVG diagram: 120×44 px viewBox, drawn with `<line>` + arrowhead `<marker>`, species
  as `<text>` labels in the diagram
- Reaction name: 10 px, uppercase, centred below SVG, coloured per reaction family
  (series = teal `#0d9488`, parallel = purple `#7c3aed`, etc.)

#### Kinetics sub-row (single mode only)

When "Single" is selected, a secondary row of chips appears below the card grid:

```
[ 1st Order ] [ 2nd Order ] [ Autocatalytic ] [ Reversible ] [ Gas-Phase ]
```

Selected chip: filled blue background, white text.
Unselected chip: outlined, grey text.

This replaces the existing `HoverDropdown` for kinetics.

#### "Custom" card

The last card has a `+` icon and "Custom" label. Clicking it:
1. Opens the Reaction Builder modal (same as current "Edit Reaction…" button)
2. Highlights "Custom" with a purple accent colour (`#7c3aed`)

#### Implementation

Create `src/components/controls/ReactionModeCards.tsx` — a component that accepts
`value: ReactionMode`, `onChange: (v: ReactionMode) => void`, and `onOpenBuilder: () => void`.
Import it inside `ParameterPopover.tsx` in the REACTION accordion section.

The SVG diagrams are defined as a static record:
```typescript
const CARD_DIAGRAMS: Record<ReactionMode, JSX.Element> = {
  'single':          <SingleDiagram />,
  'series':          <SeriesDiagram />,
  'series3':         <Series3Diagram />,
  'parallel':        <ParallelDiagram />,
  'series-parallel': <SeriesParallelDiagram />,
  'denbigh':         <DenbighDiagram />,
  'custom':          <CustomCard />,
};
```

---

## 6. Text-Based Reaction Builder — Type the Equation

### Current behaviour (from Screenshot 3)

The Reaction Builder modal has:
- **MY PRESETS** — saved preset chips (e.g. "Bimolecular ×")
- **Equation display** — a read-only box showing the current equation in large monospace
  text (e.g. `A → R`). Not editable.
- **SPECIES** table — rows with label input, Reactant/Product select, stoich number, ×
  button. "+ Reactant" / "+ Product" buttons add rows.
- **⇌ Make reversible** checkbox
- **RATE LAW** — Power Law / Michaelis-Menten / Langmuir-Hinshelwood radio buttons
- Rate parameter fields (k, Ea, T_ref, n_A)
- "+ Save as preset" button
- Footer: validation message, Cancel, Save Reaction

### What the user wants

The equation display box should become an **editable text input** where the user can
type the reaction in chemical notation and the SPECIES table is auto-populated from
what they type. The form rows below remain the "result" of parsing — fully editable
after parsing.

Additionally, the builder should be able to construct **all preset reaction network
types** (Series, Denbigh, etc.) via text, not just single reactions.

### New builder layout

```
┌─ Reaction Builder ─────────────────────────────── × ─┐
│ Define species, stoichiometry, and rate law           │
│                                                       │
│ MY PRESETS                                            │
│ [Bimolecular ×]  [Series A→R→S ×]                    │
│                                                       │
│ ┌─ EQUATION INPUT ───────────────────────────────┐   │
│ │ Type your reaction (one per line):             │   │
│ │                                                │   │
│ │  A + B -> R                                ↵  │   │
│ │  R + B -> S                                   │   │
│ │                                               │   │
│ │  ↳ Parsed: 2 reactions, 4 species (A B R S)   │   │
│ └────────────────────────────────────────────── ┘   │
│   [Parse]  ← button, or auto-parse on Enter         │
│                                                       │
│ REACTION STEPS  (one accordion per parsed reaction)  │
│                                                       │
│ ▾ Reaction 1: A + B → R                              │
│   RATE LAW   ● Power Law  ○ MM  ○ LH                 │
│   k [0.5] s⁻¹   Ea [0] kJ/mol   T_ref [300] K       │
│   n_A [1]   n_B [1]                                  │
│   ○ Reversible   Keq [4.0]                           │
│                                                       │
│ ▾ Reaction 2: R + B → S                              │
│   RATE LAW   ● Power Law  ○ MM  ○ LH                 │
│   k [0.3] s⁻¹   Ea [0] kJ/mol   T_ref [300] K       │
│   n_R [1]   n_B [1]                                  │
│                                                       │
│ [+ Save as preset]                                    │
│                                                       │
│ ─────────────────────────────────────────────────── │
│ ✓ Equation looks good    [Cancel]  [Save Reaction]   │
└───────────────────────────────────────────────────────┘
```

### Parser specification

#### Accepted syntax

| Input | Meaning |
|-------|---------|
| `A -> R` | Irreversible single reaction |
| `A + B -> R` | Bimolecular |
| `2A -> R` or `A + A -> R` | Coefficient 2 on A |
| `A -> R + S` | One reactant, two products |
| `A <-> R` or `A ⇌ R` or `A <=> R` | Reversible |
| *(blank line)* | Ignored |
| `# comment` | Ignored |
| `A -> R, A -> S` | Two reactions separated by comma |
| `A -> R -> S` | Two reactions: A→R and R→S (chain shorthand) |
| `A -> R -> S -> T` | Three-step series (chain shorthand) |
| `A + B -> R + B -> S + B -> T` | Bimolecular chain (each `+B` propagates) |

#### Parser rules

1. Split input by newlines. Each non-blank, non-comment line is one or more reactions.
2. Split a line on `,` to get individual reactions.
3. For each reaction string, detect the arrow: `->`, `→`, `<->`, `⇌`, `<=>`.
   - If `<->` / `⇌` / `<=>`: mark `reversible = true`, treat as `->`.
4. Split on arrow → left = reactants side, right = products side.
5. Each side: split on `+`, trim whitespace.
6. For each term, strip a leading integer coefficient (default = 1) from the species label.
7. Assign: reactant stoich = −coefficient, product stoich = +coefficient.
8. **Chain shorthand** (`A -> R -> S`): split on `->` and expand to pairs:
   (A,R), (R,S) → two reactions.

#### Real-time feedback

- As the user types, a debounced (200 ms) parse runs in the background.
- If parse succeeds: green banner at the bottom — "✓ Parsed N reactions, M species."
- If parse fails: red underline on the offending token + inline error tooltip.
- The REACTION STEPS accordion below updates live (no Parse button click needed).

#### Chain shorthand for preset network types

The text builder can reproduce every preset via text:

| Mode | Text to type |
|------|-------------|
| Single | `A -> R` |
| Series | `A -> R -> S` |
| 3-Step Series | `A -> R -> S -> T` |
| Parallel | `A -> R, A -> S` |
| Bimolecular | `A + B -> R + B -> S + B -> T` |
| Denbigh | `A -> R` `A -> T` `R -> S` `R -> U` (four lines) |
| Reversible | `A <-> R` |

When the parsed network matches a known preset structure, a hint appears:
`"This looks like Series A→R→S. Load preset parameters?"` with a [Load] button.

### Backward compatibility

The existing `+ Reactant` / `+ Product` button interface is kept as a secondary input
method below the text box. Users who prefer the form-driven approach can ignore the
text box and use the buttons. The two inputs stay in sync — changes to either update
the other.

---

## 7. Reaction Fires When Required Species Meet at a Reactor

### Problem

Chemistry is currently determined globally by `reactionMode` / `kinetics` parameters —
completely independent of which species are connected to which reactor. There is no
connection between the Feed node's species label (Feature 1) and the rate law used.

### Proposed behaviour

When the solver evaluates the rate inside a reactor, it checks that all reactants
required by the reaction are present in the inlet stream. If a required species is
absent (concentration ≈ 0), the reaction rate for that step is zero.

```typescript
// In unitModels.ts, evaluateRates():
function evaluateRates(C, T, reactions): number[] {
  return reactions.map(rxn => {
    // Check all reactants are present
    const missingReactant = Object.entries(rxn.stoichiometry)
      .some(([id, s]) => s < 0 && (C[id] ?? 0) < 1e-9);
    if (missingReactant) return 0;                // reaction cannot proceed
    return rxn.rateLaw(C, T, rxn.kineticParams);
  });
}
```

This means:
- A CSTR receiving only Feed-A and configured for A + B → R will produce **zero** 
  conversion (no B present). The reactor is running but starved of B.
- A CSTR receiving Feed-A and Feed-B will auto-mix them (Feature 2) and the reaction
  runs at the mixed concentrations.

#### Warning badge on reactor nodes

When a reactor's inlet stream is missing a species required by any active reaction step,
a warning badge appears on the reactor node:

```
╭────────────────────────────────╮
│  CSTR   CSTR-1   Da:1.00       │
│  ⚠ Missing: B                  │  ← warning badge
│  τ = [2] s                     │
│  Xₐ = 0.00 → 0.00             │  ← no conversion
╰────────────────────────────────╯
```

The warning is computed reactively from the last solver pass and stored in
`ReactorSegmentResult.warnings[]` (already a field on `UnitDiagnostics`).

---

## 8. Preset Reactions Are Editable

### Problem

Selecting a preset mode (e.g. "Series A→R→S") locks species labels and stoichiometry.
There is no way to rename `A` to `Glucose` or add a fourth step without rebuilding
from scratch in Custom mode.

### Proposed change

Every preset mode card (Feature 5) shows a small **pencil icon** (✎) in the top-right
corner on hover. Clicking it:

1. Opens the Reaction Builder modal (Feature 6)
2. Pre-populates the text input with the preset's equation in typed form:
   - Series A→R→S → pre-fills `A -> R -> S` in the text box
   - Denbigh → pre-fills four lines: `A -> R` / `A -> T` / `R -> S` / `R -> U`
3. Pre-fills kinetic parameters from current `params` values (k, k2, Ea, etc.)

The user edits freely, then clicks "Save Reaction." The result becomes a **custom**
reaction. The mode card grid shows the Custom card highlighted, with a tooltip:
*"Based on Series — 3 reactions, 4 species."*

#### Species rename → canvas propagation

When a species label is changed in the builder (e.g. `A` → `Glucose`):

```
Rename species "A" → "Glucose"?
  ○ In this reaction only
  ● On the canvas too (feeds, plots, stream table)
  [Cancel]  [Rename]
```

If "On the canvas too" is chosen:
- All Feed nodes with `speciesLabel = "A"` are updated to `speciesLabel = "Glucose"`
- All axis labels, stream table column headers, and tooltip text are updated
- The serialised state saves `"Glucose"` as the new id

---

## 9. Ctrl+Drag Chain-Connect

### The core idea

A single gesture creates a complete, connected chain of nodes. Instead of:
1. Place Feed → 2. Draw edge → 3. Place CSTR → 4. Draw edge → 5. Place Product

The user does:
1. Hold Ctrl → drag from canvas → release (one motion, three nodes, two edges)

### Interaction in detail

#### Trigger condition

Hold `Ctrl` (Windows/Linux) or `⌘` (Mac) **before** starting a drag from any node's
output handle, OR from empty canvas (see "Instant full-chain" below).

The cursor changes from the default arrow to a chain-link icon `⛓` when Ctrl is held
over a source handle or empty canvas.

#### Phase 1 — Ghost preview

As soon as the drag starts, a **ghost node** appears at the cursor position. The ghost is
a semi-transparent (50% opacity) version of the node type that will be placed, with a
dashed border instead of solid.

A dotted animated edge runs from the source node to the ghost.

**Default ghost type by source:**

| Source node | Default ghost |
|-------------|--------------|
| Feed | CSTR |
| CSTR | Product (if none exists) / PFR (if Product already on canvas) |
| PFR | Product (if none exists) / CSTR otherwise |
| Mixer | CSTR |
| Any reactor | Product |

**Changing the ghost type while dragging:**
- `Tab` or `Mouse wheel up/down` cycles through: CSTR → PFR → Batch → Mixer → Splitter → Product
- The ghost node redraws for each type

#### Phase 2 — Drop on empty canvas (chain continues)

Releasing on empty canvas:
1. Commits the ghost (places the real node)
2. Creates an edge from the source to the new node
3. **Immediately starts a new ghost** from the new node's output handle — the chain
   continues without requiring another Ctrl+drag
4. The user simply moves the cursor to the next position and releases

The chain continues indefinitely until deliberately ended.

#### Phase 3 — Ending the chain

| Action | Result |
|--------|--------|
| Drop on an **existing node** | Creates edge to that node, chain ends |
| Drop on a **Product** node | Creates edge to Product, chain ends (Product is a terminus) |
| Press `Escape` | Discards the current ghost, ends chain |
| Release with ghost on a **Feed** node | Rejected (Feed cannot be a target), ghost turns red, chain continues |
| Release on canvas edge (out of bounds) | Ghost discarded, chain ends |

#### Instant full-chain shortcut — Ctrl+Shift+drag from empty canvas

Holding `Ctrl+Shift` and dragging from empty canvas (not from an existing node):

1. A Feed node is placed at the drag **start** position
2. The chain ghost starts as CSTR
3. User drags to desired CSTR position and releases
4. CSTR is placed, edge Feed→CSTR is created
5. Ghost auto-advances to Product, hovering 80 px to the right of CSTR
6. User releases (or the Product auto-places after a short delay)

Result: a complete `Feed → CSTR → Product` in one drag gesture, immediately ready
to simulate.

#### Visual design — ghost node

The ghost node uses the same component as the real node, but wrapped in a CSS overlay:
```css
.chain-ghost {
  opacity: 0.45;
  pointer-events: none;    /* doesn't intercept mouse events */
  border-style: dashed !important;
  filter: drop-shadow(0 0 6px #2563eb);
}
```

The connecting dotted edge uses the existing ReactFlow edge style with:
```
strokeDasharray: "6 3"
animated: false
stroke: "#2563eb"
opacity: 0.6
```

#### Multi-reactor chain example

```
User: Ctrl+drag from empty canvas (Ctrl+Shift mode)

  [Feed placed at cursor start]
    │ (dotted ghost edge)
    ▼
  [Ghost: CSTR]           ← user sees this following the cursor

User releases:
  Feed ─── CSTR           ← CSTR placed, chain continues

  [Ghost: Product]        ← auto-advances 80px right

User releases:
  Feed ─── CSTR ─── Product   ← done, chain ends

─────

User: Ctrl+drag from CSTR output handle
  CSTR ─ ─ ─ [Ghost: Product]   ← Tab to change to PFR

  CSTR ─ ─ ─ [Ghost: PFR]       ← user presses Tab

User releases on empty canvas:
  CSTR ─── PFR              ← PFR placed, chain continues from PFR

  PFR ─ ─ ─ [Ghost: Product]

User releases:
  CSTR ─── PFR ─── Product  ← done
```

#### Keyboard & mouse summary

| Input | Action |
|-------|--------|
| `Ctrl` + drag from output handle | Start chain from that node |
| `Ctrl+Shift` + drag from empty canvas | Instant Feed → chain |
| Mouse wheel (while chaining) | Cycle ghost node type |
| `Tab` (while chaining) | Cycle ghost node type (same as wheel) |
| Release on empty canvas | Place node, continue chain |
| Release on existing node | Wire in, end chain |
| `Escape` | Discard ghost, end chain |

#### Implementation notes

**`ReactorCanvas.tsx` changes:**

1. Add state: `isChaining: boolean`, `chainSourceId: string | null`,
   `ghostPosition: {x,y} | null`, `ghostType: NodeType`.

2. In `onMouseDown` on a source handle: if `e.ctrlKey` → set `isChaining = true`,
   suppress the normal ReactFlow connection drag.

3. In `onMouseMove` (canvas-level listener while chaining): update `ghostPosition`
   from the mouse position converted to canvas coordinates using
   `reactFlowInstance.screenToFlowPosition()`.

4. Render the ghost as a positioned `<div>` inside the ReactFlow canvas (not as a real
   node) via `useStore(s => s.transform)` for the canvas-to-screen coordinate transform.

5. In `onMouseUp` (canvas-level): determine target under cursor; dispatch accordingly.

6. `keydown` effect (while `isChaining`): Escape → clear chain state.

7. Node type cycling: `ghostType` index cycles through
   `['cstr', 'pfr', 'batch', 'mixer', 'splitter', 'product']` on each Tab/wheel event.

**Why a CSS overlay, not a real ReactFlow node:**
Adding a half-opacity node to the ReactFlow nodes array would fire all node-click,
hover, and connection handlers. The ghost must be a plain positioned DOM element so
it cannot accidentally trigger interactions.

---

# Part II — Professional-Grade Direction

> **Goal:** evolve the simulator from an educational reactor tool into a credible
> early-stage process design instrument — the tool a process engineer reaches for
> *before* opening Aspen/DWSIM: fast conceptual flowsheeting, reactor selection,
> heat-and-material balances, sizing estimates, and a clean PFD/P&ID-style deliverable.
>
> **Non-goals (explicitly out of scope):** rigorous VLE with activity models,
> multi-stage distillation, dynamic pressure-flow networks, electrolytes. Those are the
> domain of full process simulators; this tool wins on speed, transparency of equations,
> and zero-install accessibility.

---

## II-A · Engineering Foundations

---

## 10. Units System — Quantity Layer

> **✅ IMPLEMENTED** — Phase 6 (F10.1): `src/math/units.ts` + `unitsSlice.ts` + Teaching / SI / Metric-Engineering profiles. `convert()` / `formatQty()` wired into store. All tests pass.

### Problem

Everything today is hard-coded in teaching units: mol/L, s, K, kJ/mol, and a
normalised feed flow of 1. Real engineers think in kmol/h, m³/h, bar, °C, kg/s.
The moment a practitioner enters plant numbers the tool silently produces nonsense
(e.g. entering k in h⁻¹ against τ in s).

### Proposed design

A pure conversion layer — **internal state stays SI-coherent, display converts**.

```
src/math/units.ts          ← pure, zero imports (numerics-style invariant)
src/store/slices/unitsSlice.ts   ← selected display profile + per-field overrides
```

Internal canonical units (never change): `mol, m³, s, K, Pa, J, kg, W`.

```typescript
type Dimension = 'concentration' | 'time' | 'temperature' | 'pressure' | 'energy'
               | 'molarFlow' | 'volFlow' | 'massFlow' | 'volume' | 'rateConst'
               | 'heatOfReaction' | 'heatCapacity' | 'ua' | 'length' | 'area';

interface UnitDef { id: string; label: string; toSI: (x: number) => number;
                    fromSI: (x: number) => number; }

const UNIT_TABLE: Record<Dimension, UnitDef[]> = { /* static data */ };

convert(value, fromUnit, toUnit): number
formatQty(valueSI, dim, profile): string      // "12.4 kmol/h"
```

Notes that make this *engineering-correct* rather than cosmetic:

- **Temperature is affine** (°C/°F ↔ K need offset, not factor) — `toSI`/`fromSI` are
  closures, not scale factors, precisely for this case.
- **Rate constants are order-dependent**: a 2nd-order k carries units of
  conc⁻¹·time⁻¹. The unit picker for k derives its dimension from the parsed reaction
  order (Feature 6 parser output), so switching a reaction from 1st to 2nd order
  re-labels k automatically and converts the stored value.
- **Unit profiles**: `SI`, `Metric-Engineering` (kmol/h, m³/h, bar, °C, kW),
  `US-Customary` (lbmol/h, ft³/h, psia, °F, BTU/h), `Teaching` (current units —
  default, keeps every existing test green).
- Every numeric `<Input>` gains a unit suffix dropdown fed by `UNIT_TABLE[dim]`;
  the store always receives SI.

### Migration & invariants

- `SimulationParams` values are reinterpreted as SI **only at the serializer
  boundary**: v(N+1) migration multiplies legacy values by the Teaching→SI factors
  and stamps `unitsVersion: 2`. Old saved files keep loading correctly.
- New invariant: **no conversion factors outside `units.ts`** (grep for `* 1000`
  near params is a review flag).
- Sweep/target/comparison engines, plots, and stream table all format through
  `formatQty` — axis labels become profile-aware for free.

**Why before everything else in Part II:** Features 11, 14, 17, 20, 21, 22 all
produce or consume dimensional quantities. Retrofitting units later means touching
every one of them twice.

---

## 11. Species Database & Real Thermochemistry

> **✅ IMPLEMENTED** — Phase 6 (F11.1 + F11.2): 60-species `speciesLibrary.json`, `thermoLibrary.ts` (Shomate Cp integrals, ΔH_rxn, Keq, atom balance / element matrix). Species binding UI added to `ReactionBuilderModal.tsx` with type-ahead and thermo banner. All 88 tests pass.

### Problem

Species are abstract labels (A, R, S…) with a single global ΔH and ρCp. A practising
engineer wants to type "methanol" and have MW, ΔH_f°, Cp(T), and phase come along —
and wants Keq(T) to follow from thermodynamics, not a typed-in constant.

### Proposed design

**1. Bundled species library** — a static JSON (no network dependency), ~60 common
industrial species (H₂, O₂, N₂, CO, CO₂, H₂O, CH₄…C₄, MeOH, EtOH, ethylene oxide,
styrene, ammonia, SO₂/SO₃, benzene/toluene/xylene, acetic acid, …):

```
src/data/speciesLibrary.json
{
  "methanol": {
    "formula": "CH3OH", "mw": 32.042,            // kg/kmol
    "phase": "liquid",                            // default phase at 298 K, 1 atm
    "dHf298": -238.4e3,  "S298": 127.2,           // J/mol, J/(mol·K), NIST
    "cp": { "type": "shomate", "range": [298, 1500], "coeffs": [ ... ] },
    "antoine": { "A": ..., "B": ..., "C": ..., "range": [253, 503] },  // for Feature 14 flash
    "rhoLiq": 792, "tc": 512.5, "pc": 8.084e6
  }, ...
}
```

**2. Species binding.** A canvas species label can be *bound* to a library entry
(builder UI: type-ahead next to the label field). Unbound species keep today's
behaviour — the abstract track never goes away, it remains the teaching mode.

**3. Computed reaction thermochemistry** (only when *all* species in a reaction are
bound):

```
ΔH_rxn(T) = Σ ν_i·[ΔH_f,i° + ∫₂₉₈ᵀ Cp_i dT]          (Kirchhoff)
ΔG_rxn(298) = Σ ν_i·ΔG_f,i°
Keq(T)    = exp(−ΔG_rxn(T)/RT)                         (with van 't Hoff slope)
```

The builder shows a banner: *"ΔH_rxn = −92.2 kJ/mol (computed) · Keq(300 K) = 6.1×10⁵
— [Use computed] [Keep manual]"*. Manual override always wins; computed values are
suggestions, mirroring how the Keq_ref/delta_H params work today.

**4. ThermoModel upgrade** (`thermoModel.ts` was explicitly structured for this):

```
deltaH(reactionId, T)  → per-reaction, T-dependent (Kirchhoff) when bound
rhoCp(C, T)            → Σ C_i·Cp_i(T) when bound; constant fallback otherwise
```

**5. Atom-balance validation.** With formulas known, the builder can *check* the
equation: `C6H12O6 -> 2 C2H5OH + 2 CO2` balances (C6H12O6 vs C4H12O2+C2O4 → ✓/✗ per
element). Unbalanced equations get a yellow warning (not an error — lumped/pseudo
species are legitimate), with a one-click "balance for me" that solves the integer
stoichiometry when a unique solution exists (linear Diophantine via nullspace of the
element matrix — small, pure function).

### Files

| File | Change |
|------|--------|
| `src/data/speciesLibrary.json` | new — static data, NIST-sourced |
| `src/math/thermoLibrary.ts` | new, pure — Cp(T), ΔH_f(T), Keq(T), element matrix, balance solver |
| `src/math/thermoModel.ts` | per-reaction ΔH(T) path; constant fallback preserved |
| `src/types/chemistry.ts` | `Species.libraryId?`, `Species.formula?`, `Species.mw?` |
| `ReactionBuilderModal.tsx` | type-ahead binding, thermo banner, atom-balance check |

van 't Hoff consistency note: when Keq(T) is computed, the reversible rate term must
use the *same* ΔH_rxn in both the energy balance and the Keq temperature dependence —
single source in `thermoLibrary.ts`, otherwise the simulator can violate
thermodynamic consistency (equilibrium drifting with path).

---

## 12. Stream as Primary Currency
*(Phase B refactor from Feature 2 — promoted to a scheduled prerequisite)*

> **✅ IMPLEMENTED** — Phase 6 (F12.1): `ProcessStream { F: Record<SpeciesId, number>, T: number, P: number }` is the primary solver currency in `networkSolver.ts`. No `Ca/Cr/Cs` in solver signatures. Tear-stream norm on `‖ΔF‖_∞`.

### Why promote it

Part I deferred replacing `StreamState {Xa, Ca, Cr, Cs, flow, T}` with the molar-flow
`Stream` type. Nearly everything in Part II — flash separators, purge balances, mass
flow tables, enthalpy flows, arbitrary user species — is awkward or impossible on a
fixed 4-slot concentration struct. This is the single highest-leverage refactor in
the codebase and it must land **before** Features 14, 16, 17, 20.

### Target representation

```typescript
interface ProcessStream {
  F: Record<SpeciesId, number>;  // molar flows, mol/s (SI per Feature 10)
  T: number;                     // K
  P: number;                     // Pa
  vaporFraction?: number;        // set by flash units; undefined = single phase
}
```

Derived, never stored: `Q_vol` (from phase densities or ideal gas), concentrations
`C_i = F_i/Q_vol`, conversion `Xa = (F_A,feedBasis − F_A)/F_A,feedBasis`, mass flows
`ṁ_i = F_i·MW_i`, stream enthalpy `H = Σ F_i·h_i(T)` (Feature 11).

### Migration strategy (keeps 40+ tests green throughout)

1. Introduce `ProcessStream` + derivation helpers in `streamBridge.ts`; keep
   `StreamState` as a *computed view* (`toStreamState(ps, basis)`).
2. Port `forwardPass` node-by-node (feed → mixer → splitter → product first, reactors
   last); golden tests pin numeric outputs at each step.
3. Reactor unit models keep concentration-space internals (rate laws are
   concentration-based) — they convert at their boundary via the bridge, which is
   exactly the ownership rule Invariant 5 already prescribes.
4. Delete `StreamState` from solver signatures; it survives only inside
   `streamBridge.ts` for plot adapters.
5. Conversion basis: `keyReactantId` molar flow at the *fresh feed*, so recycle
   topologies report overall (per-pass vs overall both shown — see Feature 20).

**Definition of done:** `networkSolver.ts` contains no `Ca/Cr/Cs` identifiers;
tear-stream error norm operates on `‖ΔF‖_∞ / F_ref`, `|ΔT|/300`, `|ΔP|/P_ref`.

---

## 13. Solver Robustness

> **✅ IMPLEMENTED** — Phase 6 (F13.1 + F13.2): Wegstein acceleration for tear streams with Direct/Wegstein/Newton selector stored in `recycleMethod` param. RK45 Dormand-Prince adaptive ODE (embedded 4(5) pair, PI step control) replaces fixed-step RK4 in `pfrModel`.

### Problem

Successive substitution with fixed 50 % damping converges linearly and stalls or
oscillates on tight recycles (high R, exothermic loops). 200-step fixed RK4 wastes
work on easy problems and silently loses accuracy on stiff ones (fast/slow series
networks, runaway PFRs). Practitioner trust dies the first time the tool reports
`converged=false` on a flowsheet Aspen solves instantly.

### Proposed upgrades (all inside `numerics.ts` / `networkSolver.ts`, pure)

**1. Wegstein acceleration for tear streams** (industry default — DWSIM/Aspen both):

```
For each tear variable x with fixed-point map g(x):
  s = (g(xₙ) − g(xₙ₋₁)) / (xₙ − xₙ₋₁)        // secant slope
  q = s / (s − 1),  clamped to [−5, 0]        // q<0 accelerates; q∈(0,1) damps
  xₙ₊₁ = q·xₙ + (1−q)·g(xₙ)
```

Applied per-component (each `F_i`, `T`) every iteration after a 3-iteration direct
warm-up. Falls back to current 50 % damping when the secant is degenerate. Expected:
recycle Test 10 converges in ~4 iterations instead of ~15; tight loops (R > 5)
converge instead of hitting the 200 cap.

**2. Newton on the tear residual** (opt-in, "tight" mode): tear vector
`x ∈ ℝⁿ`, residual `f(x) = g(x) − x`, Jacobian by forward differences (n forward
passes), dense LU solve. n is small (≤ ~8 per tear stream), so cost is trivial; gives
quadratic convergence for the operating-diagram-adjacent cases where Wegstein
zigzags. Convergence panel gets a method selector: `Direct | Wegstein | Newton`.

**3. Adaptive ODE — RK45 (Dormand–Prince) with PI step control** replacing fixed-step
RK4 in `pfrModel`, `semibatchModel`, `dynamicEngine`:

```
rk45Step(fn, t, y, h) → { y5, errEst }       // embedded 4(5) pair
h_next = h · clamp(0.9·(tol/err)^0.2, 0.2, 5)
```

- Default `rtol = 1e-6`, `atol = 1e-9`.
- Stiffness guard: if `h` collapses below `τ/10⁵` for 3 consecutive steps, flag
  `diagnostics.stiff = true` and surface a UI hint ("system is stiff — results
  validated to reduced tolerance"). A full implicit method (TR-BDF2) is a stretch
  goal — the guard alone prevents silent wrong answers today.
- Profile outputs are resampled onto a uniform 200-point grid for plots, so no chart
  component changes.

**4. Convergence diagnostics surfaced** in RecyclePanel: per-tear residual history,
method used, Wegstein q values, Newton Jacobian condition estimate. Engineers
diagnose flowsheets through these numbers; hiding them is an educational tool habit.

---

## II-B · Flowsheet Completeness

---

## 14. New Unit Operations

The minimum set that turns "reactor toy" into "conceptual flowsheet". All are
steady-state, all pure functions in `unitModels.ts` (or a new `separationModels.ts`),
all dispatched from `forwardPass` exactly like CSTR/PFR today.

### 14.1 Heat Exchanger / Heater–Cooler node (`hx`)

> **✅ IMPLEMENTED** — Phase 6 (F14.1): `hxModel()` in `unitModels.ts` (utility mode: T_out spec or Q_duty spec), `HXNode.tsx` canvas component, toolbar button, `forwardPass` dispatch, serializer migration. 5 golden tests with hand-calculated Q values.

Two modes:
- **Utility mode** (one process stream): specify either outlet T *or* duty Q̇.
  `Q̇ = Σ F_i·∫Cp_i dT`. The simple workhorse — interstage cooling, feed preheat.
- **Process–process mode** (two streams, Feature 17 details the UA model): the
  classic feed–effluent exchanger (FEHE) around a reactor — *the* canonical recycle
  energy structure, and with exothermic kinetics it produces the textbook
  ignition–extinction hysteresis (ties into Feature 18).

### 14.2 Flash Separator node (`flash`)

> **✅ IMPLEMENTED** — Phase 7 (F14.2 + F14.5): `flashModel()` + `purgeModel()` in `src/math/flashModel.ts` (Antoine pSat, Rachford-Rice via bisect, non-volatile species to liquid), `FlashNode.tsx` + `PurgeNode.tsx` canvas components, `flash`/`purge` branches in `forwardPass`, both in `UnitType`/`topologySlice`/`ReactorToolbar`, serializer migrations. 9 golden tests. 114 tests pass.

Single-stage VLE drum, ideal Raoult's law (Antoine coefficients from Feature 11):

```
K_i = P_i^sat(T)/P
Rachford–Rice:  Σ z_i·(K_i − 1)/(1 + ψ·(K_i − 1)) = 0   → solve ψ (vapor fraction)
                                                          by bisection (reuse bisect())
y_i = z_i·K_i/(1+ψ(K_i−1)),  x_i = z_i/(1+ψ(K_i−1))
```

Specs: `{T, P}` flash (isothermal) first; `{Q̇=0, P}` adiabatic flash as follow-up.
Two outlet handles: vapor (top), liquid (bottom). Species without Antoine data are
declared non-volatile (stay in liquid) with a node warning badge. This single unit
unlocks the most common real flowsheet: *reactor → cooler → flash → vapor recycle +
liquid product*.

### 14.3 Component Splitter node (`csplit`)

> **✅ IMPLEMENTED** — Phase 7 (F14.3): `csplitModel()` in `unitModels.ts`, `CSplitNode.tsx` canvas component, `csplit` branch in `forwardPass`, `CSplit` in `UnitType`/`topologySlice`/`ReactorToolbar`, serializer migration. 6 golden tests. 105 tests pass.

The honest shortcut every conceptual design course uses: per-species split fractions
`ξ_i ∈ [0,1]` to the top outlet. Models "a perfect-enough separation exists here"
(membrane, absorber, ideal column) without VLE. Trivial math, huge flowsheet value.
UI: small table of species × fraction sliders, default 0.5.

### 14.4 Pressure changers: Pump / Compressor / Valve (`pump`, `comp`, `valve`)

> **✅ IMPLEMENTED** — Phase 7 (F14.4): `pressureChangerModels.ts` (`pumpModel`, `compModel`, `valveModel`), `PumpNode.tsx`/`CompNode.tsx`/`ValveNode.tsx` canvas components, `pump`/`comp`/`valve` branches in `forwardPass`, all 3 in `UnitType`/`topologySlice`/`ReactorToolbar`, serializer migrations. 12 golden tests. 126 tests pass.

Now that streams carry P (Feature 12):

```
Pump (liquid):        Ẇ = Q_vol·ΔP/η                      (η default 0.75)
Compressor (gas):     Ẇ = (γRT₁/(γ−1))·Ṅ·[(P₂/P₁)^((γ−1)/γ) − 1]/η_isen
                      T₂ = T₁·[1 + ((P₂/P₁)^((γ−1)/γ) − 1)/η_isen]
Valve:                isenthalpic, P₂ < P₁ (ideal-gas: T unchanged)
```

These give pressure-consistent flowsheets (compressor before a high-P reactor, valve
before a low-P flash) and feed directly into Feature 22 (power → operating cost).

### 14.5 Purge node (`purge`)

> **✅ IMPLEMENTED** — See F14.2 above (implemented together).

A splitter specialisation with fraction `β` to vent — semantically distinct on the
P&ID and required by Feature 16. Carries the ISA vent symbol in P&ID mode.

### Per-node spec pattern

Every new node follows the existing pattern: type in `simulation.ts` unions, renderer
in `components/canvas/`, params in `ParameterPopover`, branch in `forwardPass`,
serializer migration entry, ≥1 golden test with hand-calculated numbers (e.g.
benzene/toluene 50/50 flash at 1 atm, 365 K — hand-checkable with Antoine tables).

---

## 15. Design Specs — Generalised Inverse Solving

> **✅ IMPLEMENTED** — Phase 6 (F15.1): `brent()` root-finder in `numerics.ts`, `DesignSpecsPanel.tsx` (vary/target form + SpecRow with ✓/✗ chips), `designSpecsSlice.ts`, `pendingDesignTarget` in `sessionSlice`. Right-click "Make this a target…" on Xₐ / yield_R / selectivity_R in StatusBar.

### Problem

`targetSolver.ts` answers exactly one question (τ or k to hit target Xa). Real design
work is full of inverse problems: *what coolant temperature keeps T_out ≤ 420 K? what
recycle ratio hits 95 % overall conversion? what purge fraction caps inerts at 8 %?*

### Proposed design

Aspen-style **Design Spec** objects — a generic 1-D solve wrapped around
`solveNetwork`:

```typescript
interface DesignSpec {
  id: string;
  vary:   { nodeId?: string; param: string; lo: number; hi: number };  // the knob
  target: { metric: 'Xa'|'T_out'|'C_i'|'yield'|'purity'|'vaporFrac'|'duty';
            nodeId?: string; speciesId?: string; value: number };      // the goal
  active: boolean;
}
```

- Solver: Brent's method (bracketing + inverse quadratic — add to `numerics.ts`,
  ~40 lines, reuses the bisect fallback) on
  `f(knob) = metric(solveNetwork(knob)) − target`.
- Multiple active specs solve sequentially with an outer Wegstein loop (sufficient
  for the weakly-coupled 2-spec cases this tool will see; a true multivariable
  Newton is deliberately out of scope).
- UI: a **Design Specs panel** listing specs with status chips
  (`✓ met · knob = 4.47 s`, `✗ no solution in [lo, hi]`), plus a right-click
  shortcut on any result readout: *"Make this a target…"*.
- `sweepEngine` composes: sweep one parameter *while* a design spec holds another
  metric constant — that is precisely how real sensitivity studies are run
  (e.g. "vary feed T, always controlling X to 90 %, plot required τ").

---

## 16. Recycle-with-Purge Template

> **✅ IMPLEMENTED** — Phase 7 (F16): (a) `src/io/examples.ts` — recycle-purge-inert example with steady-state inert balance in description; (b) `src/math/networkSolver.ts` — divergence detection: non-decelerating monotonic growth over 20 iterations triggers named `divergenceWarning` on `NetworkResult`. 2 golden tests added (convergent case = undefined, inert-accumulation case = warning fires). 128 tests pass.

### Why this specific template earns a feature

Fresh feed with inerts + reactor + separator + gas recycle + purge is *the* canonical
steady-state problem in flowsheet courses and real designs (ammonia, methanol loops).
It is also the configuration where naive simulators lie: without a purge, an inert
species accumulates without bound and the recycle loop **has no steady state** — the
solver must detect this, not just fail to converge.

### Components

1. **Example template** (`examples.ts`): Feed (A + 5 % inert I) → Mixer → CSTR →
   Flash → vapor → Splitter(purge β) → recycle to Mixer; liquid → Product. Ships with
   the inert mass balance solved in the example's description:

   ```
   Steady state inert balance:  F_I,fresh = β · F_I,recycleLoop
   → loop inert flow = F_I,fresh/β   (β→0 ⇒ unbounded — the teaching point)
   ```

2. **Divergence detection** (`networkSolver.ts`): if any tear-stream component flow
   grows monotonically for 20 consecutive iterations while others converge, abort
   early with a *named* diagnostic: `"Species I is accumulating in the recycle loop
   — no steady state exists. Add a purge or a separation that removes it."` This
   converts the worst failure mode (200 silent iterations → generic error) into the
   best teaching/engineering moment in the app.

3. **Loop composition readout**: RecyclePanel gains a converged-loop summary table
   (per-species loop flow, mol % — engineers size purges from exactly this table).

---

## II-C · Energy, Safety & Non-Ideality

---

## 17. Detailed Heat Exchange

> **✅ IMPLEMENTED** — Phase 8 (F17): `cooled-detailed` ThermalMode added; CSTR uses NTU/ε jacketed model (kappa_v_eff = ṁ_c·Cp_c·ε/V); PFR co-current adds Tc as ODE state; PFR counter-current uses bisect BVP shooting; ProfilePoint gains Tc field; serializer migration for existing nodes; 4 golden tests / All 132 tests pass.

### Problem

Cooling today is a volumetric κ_v·(T−Tc) term with constant Tc — fine for teaching,
but no engineer can map κ_v to hardware. The bridge to reality is UA and a coolant
energy balance.

### Proposed model (per reactor node, thermal mode `cooled-detailed`)

```
Jacketed CSTR:   Q̇ = UA·(T − T_c,out)         with coolant balance
                 ṁ_c·Cp_c·(T_c,out − T_c,in) = Q̇
                 → Q̇ = UA·ε_hx·(T − T_c,in)   closed form via NTU: ε_hx = 1−exp(−UA/(ṁ_c·Cp_c))

PFR co-current:    dT_c/dτ = +Ua·(T−T_c)/(ṁ_c·Cp_c/V)     integrate alongside dT/dτ
PFR counter-current: same ODE, opposite sign — boundary value problem; solve by
                   shooting on T_c at the inlet (bisect on T_c(0), reuse bisect()).
```

Parameters become physical: `U [W/m²K]`, `A [m²]` (or `Ua [W/m³K]` for PFR),
`ṁ_c [kg/s]`, `Cp_c`, `T_c,in`. Defaults map exactly onto current κ_v behaviour
(`ṁ_c → ∞` recovers constant-Tc), so the existing mode remains as `cooled-simple`
and no test changes.

### Payoff

- TemperatureProfile plot gains the coolant curve — co vs counter-current visibly
  changes the hot-spot position, a classic design insight.
- `A` flows straight into Feature 22 (exchanger costing).
- FEHE (14.1) + this model + operating diagram = honest multiplicity analysis for
  autothermal designs (Feature 18).

---

## 18. Safety & Stability Analysis

> **✅ IMPLEMENTED** — Phase 8 (F18): `safetyAnalysis.ts` with `adiabaticTemperatureRise` (ΔT_ad badge: normal/amber/red), `pfrHotSpot` (T_max + τ*), `ignitionExtinctionSweep` (S-curve sweep of cooled-CSTR steady states); `reactorSafety` map added to `NetworkResult` and computed per reactor node in solver; 8 golden tests / All 140 tests pass.

### Problem

The operating diagram already finds multiple steady states, but the safety questions
a process engineer must answer go further: *how hot can this get if cooling fails?
how close is the design to runaway? which steady state will the startup land on?*

### Proposed analyses (new `src/math/safetyAnalysis.ts`, pure)

**1. Adiabatic temperature rise** (always computed, shown as a badge on every
exothermic reactor):

```
ΔT_ad = (−ΔH_rxn)·C_A0/(ρCp)        (full conversion, cooling lost)
T_max,ad = T_in + ΔT_ad
```

Badge turns amber > 50 K, red > 150 K (configurable thresholds). This is the
single most-quoted number in reactive hazard screening, and it is nearly free.

**2. PFR hot-spot & parametric sensitivity**: report `T_max` and its position τ*;
sweep the sensitivity `S = dT_max/dT_c,in` across the coolant range and flag the
runaway boundary (where S explodes — Morbidelli–Varma criterion approximated
numerically by finite differences over the existing sweep engine).

**3. Ignition–extinction diagram**: 1-D continuation of the cooled-CSTR steady
states vs a chosen parameter (T_c,in, τ, or Ca0): march the parameter, warm-start
from the previous solution, track all G=R intersections, classify branches
(stable/unstable from the existing slope condition). Plot: S-curve with fold points
labelled **ignition** / **extinction**. The operating diagram already computes
everything needed at a single parameter value — this feature just sweeps and joins.

**4. Startup basin hint**: from the dynamic engine, integrate from cold start and
mark which steady state it lands on; overlay on the phase portrait (the
PhasePortrait component exists — this adds the separatrix context engineers
actually use it for).

**Deliberate scope limit:** no relief-device sizing (DIERS two-phase venting is
beyond a browser tool and dangerous to half-do). The doc should say so explicitly:
results are *screening-level*, banner-noted in the report (Feature 20).

---

## 19. Non-Ideal Flow & Catalyst Effects

Bridges the RTD panel (currently descriptive) to *predictive* non-ideal conversion,
and gives the fixed-bed node real catalyst physics. Three independent sub-features:

### 19.1 Axial dispersion model (PFR option)
> **✅ IMPLEMENTED** — Phase 8 (F19): nonIdealFlowModels.ts (axialDispersionConversion analytical Danckwerts-BC, segregationConversion quadrature, thieleModulus, effectivenessFactor, mearsCriterion, catalystActivity), unitModels.ts (catalyticPFR eta_eff scaling), networkSolver.ts (fixedbed η dispatch), serializer.ts (fixedbed F19 back-compat), nonIdealFlow.test.ts (16 golden tests) / All 161 tests pass.

```
(1/Pe)·d²X/dz² − dX/dz + Da·r̂(X) = 0,   Danckwerts BCs
```

Solve by shooting (RK45 + bisect on inlet gradient). Node parameter: `Pe` (or
`D_ax`). At Pe → ∞ recovers plug flow (golden test); Pe < ~10 visibly approaches
CSTR. The RTD panel gains "fit Pe from tracer data": user pastes/imports a tracer
CSV (t, C), tool computes mean/variance and `σ²/t̄² = 2/Pe − 2/Pe²·(1−e^(−Pe))` →
Pe, then *applies it to the reactor node* — measurement to model in two clicks.

### 19.2 Segregation model (any RTD)

`X̄ = ∫ X_batch(t)·E(t) dt` over the panel's E(t) — quadrature over existing pieces
(batch trajectory × RTD), gives the bounding-case conversion for any kinetics, and
makes the micro/macromixing teaching point quantitative.

### 19.3 Effectiveness factor & deactivation (fixed-bed node)

```
Thiele:   φ = R_p·√(k·ρ_cat/D_e)            (sphere, 1st order)
η = (3/φ²)·(φ·coth φ − 1);    rate_observed = η·rate_intrinsic
External film check: Mears criterion badge (r·ρ_b·R_p·n)/(k_c·C_Ab) < 0.15
Deactivation: da/dt = −k_d·aᵈ  → a(t) panel; for steady-state solve, a is a
slider ("catalyst age") scaling all bed rates.
```

Node parameters: `R_p, D_e, ρ_cat, k_d, d`. Output: η displayed on the node
(η = 0.43 tells the engineer immediately the bed is diffusion-limited — pellet size
is the knob, not temperature).

---

## II-D · Professional Deliverables

---

## 20. Engineering Stream Table & HMB Report

### Problem

The current StreamTablePanel shows the solver's internal view (Xa, Ca, Cr, Cs).
A deliverable stream table — the heat-and-material balance (HMB) — is the universal
currency of process engineering: numbered streams in columns, properties in rows,
molar/mass/energy all reconciled.

### Proposed deliverable (depends on Features 10, 11, 12)

**Stream table, industry layout** (columns = streams, rows = properties):

```
Stream No.            │   1      2      3      4      5
Description           │  Feed   Mix    Rxr out Recycle Product
Temperature      [°C] │  26.9   31.2   78.4    78.4    78.4
Pressure        [bar] │  1.01   1.01   1.01    1.01    1.01
Vapor fraction    [—] │  0.00   0.00   0.00    0.00    0.00
Total molar  [kmol/h] │  3.60   10.8   10.8    7.20    3.60
Total mass     [kg/h] │  ...
Component molar flows [kmol/h]
  A                   │  3.60   5.95   2.35    ...
  R                   │  0.00   ...
Composition (mol %)   │  ...
Molar enthalpy [kJ/mol]│ ...
```

- Stream numbering auto-assigned in topological order, editable; numbers render as
  chips on canvas edges (and as ISA diamonds in P&ID mode, Feature 21).
- **Balance check row**: overall and per-element in/out closure with % error —
  green ✓ at < 0.1 %. A table that *proves* its own consistency is what separates
  engineering output from a screenshot.
- Per-pass vs overall conversion both reported for recycle flowsheets (the eternal
  ambiguity, resolved explicitly).
- Export: CSV and XLSX-compatible CSV; copy-as-Markdown for reports.

**One-click HMB report** (extends the existing HTML export engine): title block
(project/author/date/revision), flowsheet snapshot (PNG export exists), stream
table, equipment summary (Feature 22), reaction set with rate laws as rendered
equations, assumptions & model notes auto-generated from active models ("ideal
Raoult flash", "screening-level safety numbers", solver tolerances), convergence
report. Print-CSS → PDF via browser print. This turns a simulation session into a
submittable design memo.

---

## 21. P&ID / PFD Mode

### Problem statement

The canvas renders friendly teaching cards. Process designers and P&ID makers need
the same topology drawn in the symbol language their colleagues read: ISA-5.1 /
ISO 10628 equipment outlines, tag numbers, stream diamonds, title block.

### Proposed design — a *view mode*, not a second editor

A toggle: `Schematic (current) ↔ PFD`. Same nodes, same edges, same store — only the
renderers swap (a parallel set of node components, selected by a `viewMode` value in
a UI slice). Nothing in the math layer changes; this is a presentation-layer feature
with outsized professional value.

**Symbol set** (`src/components/pid/symbols/`, hand-drawn SVG, ISO 10628-flavoured):

| Node | Symbol |
|------|--------|
| CSTR | vertical vessel with agitator motor stub |
| PFR / FixedBed | horizontal cylinder (FixedBed with catalyst hatching) |
| Batch/Semibatch | vessel with dashed level line |
| HX | circle with crossing tube path (TEMA-generic) |
| Flash | vertical drum, tangent lines, demister dashes |
| Pump | circle + triangle; Compressor | trapezoid; Valve | bowtie |
| Mixer/Splitter | line junctions (no equipment outline — correct PFD practice) |
| Feed/Product | off-page connector arrows |
| Purge | vent-to-flare arrow |

**Tagging** (`src/math/tagging.ts`, pure): auto-assigned ISA-style tags by class —
`R-101, R-102…` (reactors), `E-101…` (exchangers), `V-101…` (drums), `P-101A/B…`
(pumps), `K-101…` (compressors). Sequence in topological order, user-overridable,
persisted, uniqueness-validated. Tags appear in the stream table and equipment
summary (Features 20, 22) — consistent cross-referencing is the whole point.

**Annotations:** stream number diamonds on edges; basic instrument bubbles (TI, PI,
FI, TC on jacketed reactors — generated from which parameters are *specified*:
a controlled-T reactor implies a TC bubble). This is deliberately PFD-level
instrumentation, not full loop diagrams.

**Title block** (bottom-right, ISO 7200-ish): project, drawing title, drawn by,
date, revision table fed from scenario history.

**Export:** SVG (native), PNG (existing pipeline), and **DXF** (R12 ASCII subset —
LINE/CIRCLE/ARC/TEXT entities only, ~300 lines of pure string generation in
`src/io/dxfExport.ts`) so the drawing opens in AutoCAD-family tools where real
P&IDs are finished. DXF-R12 is ancient precisely because everything reads it.

---

## 22. Equipment Sizing & Cost Estimation

### Problem

The simulator stops at τ and conversion. The next questions are always: *how big is
the vessel, how much area does the exchanger need, what does it cost?*

### Proposed design (`src/math/sizing.ts`, `src/math/costing.ts`, both pure)

**Sizing (from converged results — runs after solve, changes nothing upstream):**

```
Reactor vessel:  V_design = f_safety·τ·Q_vol   (f_safety default 1.2, liquid full)
                 L/D = 3 (CSTR vertical) → D = (4V/3π)^(1/3); wall t from P_design
                 (thin-wall: t = P·D/(2·S·E − 1.2P) + CA, flag if t > D/10)
PFR:             V → tube count at standard D_tube, L; or single coil
Fixed bed:       W_cat already computed → bed D, L at given aspect ratio, ΔP via
                 existing Ergun (now with real gas density from Features 10–12)
Flash drum:      Souders–Brown  u_max = K_SB·√((ρ_L−ρ_V)/ρ_V), K_SB = 0.107 m/s
                 → D from vapor load; L/D = 3, hold-up checked ≥ 5 min liquid
HX:              A = Q̇/(U·ΔT_lm) with U from a small service-pair lookup table
Pump/Compressor: power from Feature 14 + motor efficiency
```

**Costing — screening level, clearly labelled (±40 %, AACE Class 5):** module
costing à la Turton, `log₁₀(C_p°) = K₁ + K₂·log₁₀(S) + K₃·(log₁₀ S)²` per equipment
class, bare-module factors, CEPCI index field (user-set, default noted with year),
total module cost + utility operating cost (coolant duty, compressor power ×
user-set utility prices) → simple **Economic Potential** readout:
`EP = product value − feed cost − utilities − annualised capital`.

**EP as a sweep/optimiser objective** (Features 15, 23): "vary τ to maximise EP"
is the canonical conceptual-design loop (Douglas methodology) — wiring it in turns
the simulator into a genuine design-space explorer.

**Equipment Summary panel/report section:** tag, type, size spec (V, D×L, A, kW),
material placeholder, cost columns — feeds the HMB report (Feature 20) and renders
beside tags in P&ID mode (Feature 21).

---

## 23. Optimisation Engine

### Problem

The sweep engine answers "what does the landscape look like" in 1-D. Design work
asks "find the best point" in 2–4 dimensions (τ, T_c, recycle ratio, purge β…).

### Proposed design (`src/math/optimizer.ts`, pure)

- **Algorithm: Nelder–Mead simplex** with box constraints via reflection-clamping.
  Derivative-free (solveNetwork is noisy near convergence tolerances — gradients
  would lie), ~120 lines, no dependencies, bulletproof for n ≤ 5.
- **Objectives:** any Design-Spec metric (Feature 15) or EP (Feature 22);
  maximise/minimise toggle.
- **Constraints:** penalty method on Design-Spec-style metrics
  (`T_max ≤ 420 K`, `purity ≥ 99 %`) — quadratic penalty, weight auto-scaled to
  objective magnitude.
- **Failed solves** (non-converged flowsheet at a trial point) return objective
  `+∞` — the simplex routes around non-convergent regions, which is exactly the
  desired behaviour and trivially correct with NM (no gradient to poison).
- **UI — Optimise panel:** variable checklist with bounds (auto-filled from
  schema ranges), objective dropdown, constraint rows, live convergence sparkline,
  result card with "apply to flowsheet" button. 2-D case offers a contour plot
  (reuse sweep grid) with the simplex path overlaid — genuinely instructive.
- Iteration budget (default 200) with a progress toast; runs in a `Promise`-yielding
  loop so the UI stays live (math stays pure — the *driver* lives in a hook,
  matching the dynamic engine pattern).

---

## 24. Interoperability

### Why it earns a slot

A tool used *before* Aspen/DWSIM must hand its results *to* those tools, and accept
kinetics from where they live (papers, Cantera files, spreadsheets).

### Proposed scope (deliberately thin, all in `src/io/`)

1. **Kinetics import — Cantera YAML subset**: parse `species:` (name, composition,
   thermo NASA7) and `reactions:` (equation string — reuse the Feature 6 parser! —
   plus `rate-constant: {A, b, Ea}`). Modified-Arrhenius `b` exponent becomes a
   supported (if rarely UI-exposed) rate parameter. Unsupported blocks (falloff,
   three-body, surface) are listed in a skip report rather than failing the import.
2. **Kinetics export** of any built reaction set to the same YAML subset — makes the
   reaction builder a *general authoring tool* whose output outlives this app.
3. **Stream table CSV** import/export in a documented column schema (Feature 20),
   so feed definitions can come from spreadsheets and results go back into them.
4. **Flowsheet JSON schema published** (`docs/schema/flowsheet.schema.json`,
   generated from the serializer types): versioned, documented — third parties (or
   scripts, or an LLM) can generate valid flowsheets. The serializer's migration
   map already gives this stability guarantees; publishing the schema makes it
   a contract.
5. **Non-goal:** Aspen `.bkp`/.dwxmz round-trip (proprietary/huge). State this in
   the doc so the question is settled.

---

## Amendments to Architectural Invariants

Part II respects all seven existing invariants and adds four:

8. **Units boundary**: all unit conversion lives in `src/math/units.ts`; store and
   math layer are SI-only; no numeric literals performing unit conversion anywhere
   else.
9. **Data files are inert**: `src/data/*.json` contains data only — no thermo data
   hard-coded in TypeScript source (keeps the species library reviewable and
   swappable).
10. **Sizing/costing downstream-only**: `sizing.ts`/`costing.ts` consume
    `SimulationResult` and never feed back into the solve (no circular
    cost→parameter coupling; the optimiser couples them explicitly and only there).
11. **View modes share one store**: PFD mode may add renderers and pure layout/tag
    utilities, never parallel topology state.

Invariant 1 (single kinetics branching point) is *unchanged* by Part II — note that
Features 11/24 add data sources for rate parameters, not new branching.

---

## Cross-Feature Interaction Map

```
Part I
Feature 1 (species-aware feed)
  └─ enables ──→ Feature 2 (multi-feed mixing knows which species)
  └─ enables ──→ Feature 7 (species-meeting trigger checks feed labels)
Feature 2 (multi-feed mixing)
  └─ enables ──→ Feature 7 (correct concentrations after mixing)
Feature 4 (popover consolidation) ── contains ──→ Feature 5 (mode cards)
Feature 5 (mode icon cards) ── adds edit button ──→ Feature 8 (preset editing)
Feature 6 (text reaction builder)
  └─ enables ──→ Feature 7, Feature 8
  └─ reused by ──→ Feature 24 (Cantera equation strings parse via same parser)
Feature 8 (preset editing) ── depends on ──→ Features 5 + 6

Part II — foundations fan out
Feature 10 (units)    ──→ 11, 14, 17, 20, 21, 22 (all dimensional consumers)
Feature 11 (species DB)──→ 14.2 (Antoine→flash), 17 (Cp), 20 (mass/enthalpy rows),
                           22 (densities for sizing)
Feature 12 (Stream currency) ──→ 14 (all separation/pressure units), 16 (purge
                           balances), 17 (enthalpy flows), 20 (stream table)
Feature 13 (solver)   ──→ 16 (tight recycle convergence), 15/23 (fast inner solves)

Part II — composition chains
14.1 HX + 17 (UA) + 18 ──→ autothermal ignition–extinction analysis
14.2 Flash + 16 purge  ──→ canonical recycle loop template
15 Design Specs ──→ 23 (optimiser constraints reuse spec metrics)
20 Stream table + 21 tags + 22 equipment summary ──→ HMB report (one deliverable)
22 EP objective ──→ 23 (economic optimisation)
```

---

## Suggested Implementation Order

### Part I tracks (unchanged)

**Track A — Solver fixes (high value, low risk)**
1. `mixStreams` for all reactor inlets — **30 min**
2. Automatic N-way flow split — **1 hour**
3. Missing-species rate suppression + warning badge — **2 hours**

**Track B — Parameter UI consolidation**
4. Remove `ParameterPanel` body, expand `ParameterPopover` — **3 hours**
5. Reaction mode icon cards (`ReactionModeCards.tsx`) — **1 day**

**Track C — Reaction builder**
6. Text equation parser (pure function, no UI) — **1 day**
7. Multi-step accordion UI in builder modal — **1 day**
8. Preset → editable text pre-population — **3 hours**
9. Species rename → canvas propagation — **2 hours**

**Track D — Species-aware feeds**
10. `FeedData.speciesLabel` field + serialiser migration — **2 hours**
11. Feed node visual update (species colour, label display) — **3 hours**

**Track E — Canvas interaction**
12. Ctrl+drag chain-connect (ghost overlay + state machine) — **2–3 days**

### Part II phases (sequenced by dependency, not by appeal)

**Phase 6 — Foundations** *(everything else stacks on this; do not reorder)*
1. Feature 10 units layer + Teaching profile default — **2 days**
2. Feature 12 Stream-as-currency refactor (node-by-node, tests pinned) — **3–4 days**
3. Feature 13.1 Wegstein + 13.3 RK45 — **2 days**
4. Feature 11 species library + thermo (Kirchhoff/van 't Hoff, atom balance) — **3 days**

**Phase 7 — Flowsheet completeness**
5. Feature 14.1 HX (utility mode) + 14.3 component splitter — **2 days**
6. Feature 14.2 flash (Rachford–Rice) + 14.5 purge — **2–3 days**
7. Feature 16 recycle-with-purge template + divergence diagnostic — **1–2 days**
8. Feature 15 design specs (Brent + panel) — **2 days**
9. Feature 14.4 pressure changers — **1–2 days**

**Phase 8 — Depth** *(items independent; pick by interest)*
10. Feature 17 UA heat exchange (CSTR closed-form first, PFR shooting second) — **2–3 days**
11. Feature 18 safety pack (ΔT_ad badge ½ day; S-curve continuation 2 days) — **2–3 days**
12. Feature 19.1 dispersion + tracer fit — **2 days**; 19.3 effectiveness — **1–2 days**

**Phase 9 — Deliverables** *(the professional payoff; order within phase is free)*
13. Feature 20 stream table + HMB report — **3 days**
14. Feature 21 PFD mode (symbols 2 days, tags ½ day, DXF 1–2 days) — **4 days**
15. Feature 22 sizing + costing + EP — **3 days**
16. Feature 23 Nelder–Mead optimiser + panel — **2–3 days**
17. Feature 24 Cantera YAML + published schema — **2 days**

Rule of thumb for the whole of Part II: **foundations are strictly ordered
(10 → 12 → 13 → 11), everything after is a DAG** — Phases 7/8/9 items can interleave
as long as each item's listed dependencies have landed. Each item follows the
established loop: spec from this doc → implementation → invariant grep + golden test
with a hand-calculated number → commit.

**Phase 10 — UI/UX Refinements (Part III)** *(items independent; any order)*

1. Feature 30 cursor-sticking fix — **30 min** *(one-liner, highest ROI)*
2. Feature 31 remove redundant dropdown bar — **1 hour** *(pure deletion)*
3. Feature 26 accordion no-jump — **1 hour** *(CSS max-height + overflow)*
4. Feature 33 canvas toolbar for Save/Load/Examples/Export — **2 hours**
5. Feature 25 single-click context menu — **1 hour**
6. Feature 27 reaction builder as portal overlay — **2 hours**
7. Feature 32 reactor node "name | Da" label format — **2–3 hours**
8. Feature 29 stream table full-height flex fill — **1 hour** *(depends on 28)*
9. Feature 28 resizable layout partitions (drag handles) — **3–4 hours**
10. Feature 34 Blender-inspired layout overhaul + dark mode — **1–2 days**

---

# Part III — UI/UX Refinements (Blender-Inspired)

> **Source:** User feedback + Blender 4.5.1 LTS screenshot review, 2026-06-11 (third pass).  
> These are quality-of-life and layout improvements inspired by Blender's philosophy:
> non-modal, drag-resizable panels, consistent spatial layout, zero redundant controls.

---

## 25. Context Menu: Single-Click Open, Click-Away Close

### Current behaviour

The canvas right-click context menu (CanvasAddMenu) opens on right-click and closes
only via Escape, clicking a menu item, or clicking outside it. Opening requires a
right-click gesture; there is no keyboard-friendly single-click trigger.

### Proposed change

- **Single left-click** on empty canvas → opens CanvasAddMenu at cursor position
  (in addition to existing right-click, or as the sole trigger — TBD by preference)
- **Click anywhere on canvas outside the menu** → closes the menu immediately
- The menu's existing `mousedown` outside-click handler already handles close;
  the trigger change is in `ReactorCanvas.tsx` `onPaneClick`.

### Files

| File | Change |
|------|--------|
| `src/components/canvas/ReactorCanvas.tsx` | Add `onPaneClick` (or update it) to open CanvasAddMenu on left-click, pass screen + flow coords |
| `src/components/canvas/CanvasAddMenu.tsx` | Confirm `mousedown` outside-click handler closes on single click (already implemented) |

---

## 26. Params Accordion: No Layout Jump on Toggle

### Current behaviour

Opening or closing an accordion section in the ParameterPopover causes adjacent
sections to shift position abruptly — panel height changes and content jumps.
This is visually disorienting when comparing values across sections.

### Proposed change

Fix the popover to a **constant height** with `overflow-y: auto` — the panel scrolls
internally; nothing outside it moves:

```css
.parameter-popover {
  max-height: calc(100vh - 120px);
  overflow-y: auto;
}
```

Alternatively use CSS height transitions on accordion bodies:
```css
.accordion-body {
  overflow: hidden;
  max-height: 0;
  transition: max-height 0.15s ease;
}
.accordion-body.open {
  max-height: 600px;
}
```

The fixed-height + scroll approach is simpler and avoids animation jank when content
height is unknown. Either eliminates the layout jump.

### Files

| File | Change |
|------|--------|
| `src/components/controls/ParameterPopover.tsx` | Add `max-height` + `overflow-y: auto` to popover container |

---

## 27. Params Panel: Vertical Scroll to Fit Reaction Builder Modal

### Current behaviour

The ReactionBuilderModal is a large overlay (500+ px tall). When it opens it either
extends beyond the ParameterPopover bounds or gets clipped by `overflow: hidden`
on a parent element.

### Proposed change

Render the ReactionBuilderModal as a **portal** targeting `document.body` so it is
positioned `fixed` and independent of any parent scroll/overflow context:

```typescript
// ReactionBuilderModal.tsx
import { createPortal } from 'react-dom';

return createPortal(
  <div style={{ position: 'fixed', inset: 0, zIndex: 500, ... }}>
    {/* modal content */}
  </div>,
  document.body,
);
```

This decouples modal height entirely from the popover, eliminating all overflow-clip
and z-index issues.

### Files

| File | Change |
|------|--------|
| `src/components/controls/ReactionBuilderModal.tsx` | Wrap return in `createPortal(…, document.body)`, use `position: fixed` |
| `src/components/controls/ParameterPopover.tsx` | Remove any `overflow: hidden` that clips the modal |

---

## 28. Resizable Layout Partitions

### Current behaviour

The canvas / right-column split and the graph-section / stream-table split have
fixed proportions. There is no way to collapse graphs, widen the canvas, or give
more vertical space to the stream table.

### Proposed design (Blender-inspired — every panel border is draggable)

**Horizontal divider — canvas ↔ right column:**
- A 4 px drag handle on the shared border. Cursor: `col-resize`.
- Dragging adjusts split; minimum 30 % canvas, minimum 20 % right column.
- Width stored in `sessionSlice` as `rightColWidth: number` (default 380 px).

**Vertical divider — graph section ↔ stream table:**
- A 4 px drag handle between graphs and stream table. Cursor: `row-resize`.
- Height stored in `sessionSlice` as `graphHeight: number` (default 280 px).

**Graph section collapse toggle:**
- A `▼ / ▲` chevron on the graph section header collapses it to just the header bar.
  Stream table expands to fill. State: `graphCollapsed: boolean` in `sessionSlice`.

### Implementation pattern

```typescript
const handleMouseDown = (e: React.MouseEvent, axis: 'x' | 'y') => {
  const start = axis === 'x' ? e.clientX : e.clientY;
  const startSize = axis === 'x' ? rightColWidth : graphHeight;
  const onMove = (ev: MouseEvent) => {
    const delta = (axis === 'x' ? ev.clientX : ev.clientY) - start;
    axis === 'x' ? setRightColWidth(startSize - delta) : setGraphHeight(startSize + delta);
  };
  const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};
```

### Files

| File | Change |
|------|--------|
| `src/store/slices/sessionSlice.ts` | Add `rightColWidth`, `graphHeight`, `graphCollapsed` with setters |
| `src/App.tsx` | Add drag handles; read sizes from store for inline style widths/heights |

---

## 29. Stream Table: Full Right-Column Height

### Current behaviour

The StreamTablePanel occupies a fixed pixel height and does not expand to fill
remaining vertical space when the graph section is shorter or collapsed.

### Proposed change

Apply `flex: 1` to the stream table wrapper so it always fills from the bottom
of the graph section to the bottom of the viewport:

```css
.right-column { display: flex; flex-direction: column; }
.graph-section { flex: 0 0 auto; }          /* sized by graphHeight */
.stream-table-panel { flex: 1 1 0; overflow-y: auto; }   /* fills remainder */
```

When the graph section is collapsed (Feature 28), the stream table fills the entire
right column — maximum information density.

### Files

| File | Change |
|------|--------|
| `src/App.tsx` | Apply flex column to right panel; `flex: 1` on StreamTablePanel wrapper |

---

## 30. Fix: Reactor Node Cursor Sticking on Mode Select

### Current behaviour

Clicking a thermal mode option (Isothermal / Adiabatic / Cooled / Heated) inside a
reactor node causes the node to follow the cursor as if a drag is in progress even
after the option is selected.

### Root cause

ReactFlow interprets a `mousedown` on any element inside a node as the start of a
node drag. The mode button click sets the option, but ReactFlow never receives the
`mouseup` to end the drag because the initial `mousedown` was not stopped.

### Fix

Add `onMouseDown={(e) => e.stopPropagation()}` to the thermal mode selector element
so ReactFlow does not capture the drag start:

```tsx
<button
  onMouseDown={(e) => e.stopPropagation()}
  onClick={() => setThermalMode(mode)}
>
  {mode}
</button>
```

This is the standard ReactFlow pattern for interactive controls inside nodes.

### Files

| File | Change |
|------|--------|
| `src/components/canvas/ReactorNode.tsx` | Add `onMouseDown={e => e.stopPropagation()}` to thermal mode selector buttons/divs |

---

## 31. Remove Redundant Mode/Kinetics Dropdown Bar

### Current behaviour

A bar above the canvas contains:
- **MODE** dropdown (Single / Series / Parallel / etc.)
- **KINETICS** dropdown (1st Order / 2nd Order / etc.)
- Equation display chip
- "Edit Reaction" button

These are duplicated by the ParameterPopover's REACTION accordion, creating two
places to change the same setting and confusing new users.

### Proposed change

**Remove the MODE and KINETICS dropdowns** from the toolbar entirely. The small
equation chip and "Edit Reaction" shortcut button may remain as compact references.

The ParameterPopover becomes the sole reaction control point. This frees horizontal
toolbar space and eliminates the duplication.

### Files

| File | Change |
|------|--------|
| `src/App.tsx` | Remove or minimise the ParameterPanel from the layout |
| `src/components/controls/ParameterPanel.tsx` | Reduce to equation display chip + Edit Reaction button only |

---

## 32. Reactor Node Label: "name | Da" Format with Editable Name

### Current behaviour

Reactor nodes show a single label (`CSTR-1`) with no computed metric on the node
face. Damköhler number and conversion are only visible in the status bar or param
panel.

### Proposed format

```
┌──────────────────────────────────┐
│  CSTR-1          │   Da=1.23     │
│  (dbl-click edit)│  (read-only)  │
└──────────────────────────────────┘
```

Left half: editable **name** (double-click to rename, same as current).  
Right half: **Damköhler number** (or relevant metric per type), read-only, muted
colour, updated by the solver.

#### Metric per node type

| Node type | Right-side metric |
|-----------|------------------|
| CSTR / PFR / Batch | `Da = k·τ` (first-order equivalent) |
| FixedBed | `W/FA0` (weight-time) |
| HX | `Q = ±N kW` (duty from last solve) |
| Mixer / Splitter / Feed / Product | *(none)* |

If no solve result exists yet: right side shows `—`.

### Files

| File | Change |
|------|--------|
| `src/components/canvas/ReactorNode.tsx` | Split label into left (name) + right (Da) areas; right reads `SimulationResult` via store selector |
| Other node components | Apply same pattern where applicable |

---

## 33. Relocate Save/Load/Examples/Export to Canvas Top Toolbar

### Current behaviour

Save, Load, Export, and Examples controls share space in the ParameterPanel bar or
a global header, competing with reaction/kinetics controls.

### Proposed change

A **dedicated canvas toolbar** strip at the top of the canvas panel:

```
┌───────────────────────────────────────────────────────────────┐
│  💾 Save   📂 Load   📋 Examples ▾   📤 Export   ↩ Undo ↪ Redo  │
└───────────────────────────────────────────────────────────────┘
```

- Positioned above the ReactFlow canvas, inside the canvas panel column
- Fixed height 32–36 px; always visible
- Undo/Redo buttons here (currently absent from the UI)
- The params column is freed from file I/O controls

Mirrors Blender's top header bar: controls live on the editor they operate on,
not in a global title bar shared with unrelated UI.

### Files

| File | Change |
|------|--------|
| `src/App.tsx` | Insert `<CanvasToolbar />` above `<ReactorCanvas>` in canvas panel |
| `src/components/canvas/CanvasToolbar.tsx` | New file: Save / Load / Examples / Export / Undo / Redo |
| `src/components/controls/ParameterPanel.tsx` | Remove Save / Load / Export buttons |

---

## 34. Blender-Inspired Overall Layout & UX

### Vision

Blender 4.x uses a **tiling panel system**: every border between areas is draggable,
every panel has its own header and toolbar, and the default layout is immediately
functional with zero mode switching. Net effect: dense information, minimal
navigation overhead, maximum viewport for active work.

### Target layout

```
┌──────────────────────────────────┬───────────────────────────────┐
│  Canvas toolbar (Feature 33)     │  Right column header           │
│  [Save][Load][Examples][Export]  │  [Levenspiel][Profiles][Design]│
├──────────────────────────────────┤                                │
│                                  │  Graph / Analysis tabs         │
│       ReactFlow canvas           │  (resize handle ↕, Feature 28) │
│                                  ├───────────────────────────────┤
│   (resize handle ↔, Feature 28)  │  Stream table (flex-1, F29)   │
│                                  │                                │
└──────────────────────────────────┴───────────────────────────────┘
│  Status bar: Xₐ=0.76  yield=0.71  …  ← right-click for targets   │
└────────────────────────────────────────────────────────────────────┘
```

### Specific Blender patterns to adopt

1. **No modal dialogs for frequent actions** — reaction builder remains a modal
   (complex form), but all other settings should be in-place (popover or inline).
2. **Every displayed number is directly editable** — click τ on a node face, T_out on
   an HX, or split fraction on a Splitter to edit in place without opening a panel.
3. **Consistent keyboard shortcuts** — `X` delete, `D` duplicate, `A` select-all,
   `Ctrl+Z` / `Ctrl+Shift+Z` undo/redo, `/` context menu, `Escape` deselect.
4. **Context-sensitive params column** — shows selected node's params when a node
   is selected, global params otherwise. One panel, no separate "open" button.
5. **Dark mode** — a toggle (or dark default) immediately signals "professional tool".
   CSS variable swap: `--bg: #1a1a2e`, `--panel: #252535`, `--text: #e2e8f0`.

Each item is a progressive enhancement — they land independently but together
shift the tool's feel from teaching sandbox to professional instrument.

### Files

| File | Change |
|------|--------|
| `src/App.tsx` | Revised layout per ASCII diagram above |
| `src/index.css` | Dark mode CSS variable set; light/dark toggle |
| Various node components | Inline-editable τ, T_out, split α on double/single click |
| `src/store/slices/sessionSlice.ts` | Add `theme: 'light' \| 'dark'` |

---

*Document created 2026-06-11 from screenshots and source code review.*  
*Part II added 2026-06-11 — professional-direction second pass (Features 10–24).*  
*Part III added 2026-06-11 — Blender-inspired UI/UX refinements (Features 25–34).*  
*Update when features are implemented.*
