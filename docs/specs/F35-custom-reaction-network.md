# TASK F35 — Custom Multi-Reaction Network Builder

## Your role
You are implementing a feature in an existing React 18 + TypeScript 5 + Vite + Zustand
chemical-engineering flowsheet simulator. I am the engineer; you implement exactly what is
specified here. Do not invent scope. Do not redesign architecture. When this spec says a file
or function already exists and works, treat it as immovable and build around it.

You cannot see images. Every visual requirement in this document is described in words. Build
to the words.

---

## Final goal
Let the user define an **arbitrary reaction network** (not just one reaction) through the
Reaction Builder modal — parallel reactions, series chains (A→R→S→T), Denbigh systems
(A→R, A→T, R→S, R→U), and any combination — by **typing the reactions as text**, with a
**live auto-generated network diagram** and an **auto-detected species list** as read-only
mirrors. Each reaction gets its own rate law and parameters. The network is solved by the
EXISTING solver with NO solver changes.

**Acceptance anchor:** a Denbigh network *typed into the custom builder* must produce numerically
identical reactor results to *selecting the built-in Denbigh preset*. Same for series and parallel.
These equivalences are your correctness oracle and must be covered by tests.

---

## What ALREADY EXISTS — DO NOT rebuild or modify
These are general and correct. Touching them is out of scope and will break invariants.

1. `src/types/chemistry.ts` — `ChemistryModel.reactions: Reaction[]` is already a list. Each
   `Reaction` has `stoichiometry: Record<SpeciesId, number>`, `rateLaw: RateLawFn`,
   `kineticParams: Record<string, number>`. **Do not change this interface.**
2. `src/math/unitModels.ts` — `netProductionRate()` already sums `dC[s] = Σ_r stoich_rs · rate_r`
   over all reactions and species. CSTR-multi, PFR, and Batch integrators already call it.
   **The solver needs ZERO changes. Do not edit networkSolver.ts or the ODE assembly.**
3. `src/math/equationParser.ts` — `parseEquations(text): ParsedReaction[]` already parses
   multi-line input, expands `A -> R -> S` into two reactions, and handles `<->` reversible.
   **Reuse it. Do not rewrite it.** (You MAY extend it only if you must add `⇌`/`→` unicode
   aliases — see DO's.)
4. `src/math/reactionRegistry.ts` — the canned presets (`seriesPreset`, `parallelPreset`,
   `denbighPreset`, `series3Preset`, `seriesParallelPreset`) prove the solver runs networks.
   `presetToText(mode)` already returns editable multi-line text for each preset. `getPreset()`
   is the ONLY kinetics branch point.
5. `src/math/thermoModel.ts` — `ThermoModel.deltaH(reactionId, T)` is already keyed by reaction id.

---

## What to BUILD

### 1. Types — `src/types/simulation.ts`

Replace the single-reaction `CustomReaction` with a network model. Keep the OLD interface under a
new name `LegacyCustomReaction` (used only by the serializer migration).

```typescript
export type RateType = 'power-law' | 'michaelis-menten' | 'langmuir-hinshelwood';

// One reaction within a custom network.
export interface CustomNetworkReaction {
  id: string;                                    // stable, e.g. 'cr-1' (never reused)
  reactants: { species: string; coeff: number }[];
  products:  { species: string; coeff: number }[];
  reversible: boolean;
  rateType: RateType;
  rateParams: Record<string, number>;            // see "rate param keys" below
  deltaH?: number;                               // kJ/mol, per-reaction heat of reaction (optional)
}

// Per-species metadata, keyed by species symbol (e.g. 'A', 'R').
export interface CustomSpeciesMeta {
  boundLibraryId?: string;                       // id into the species library, or undefined = abstract
  phase?: 'g' | 'l' | 's';
  feedConc?: number;                             // mol/L present in the feed; undefined/0 = intermediate/product
}

// The whole custom reaction network. This becomes the new value of params.customReaction.
export interface CustomReactionNetwork {
  reactions: CustomNetworkReaction[];
  speciesMeta: Record<string, CustomSpeciesMeta>;
  keyReactantId?: string;                        // default: first reactant of reactions[0]
}

// Kept ONLY so the serializer can type the old shape during migration. Mark @deprecated.
export interface LegacyCustomReaction {
  species: { id: string; label: string; role: 'reactant' | 'product'; stoich: number }[];
  rateType: RateType;
  rateParams: Record<string, number>;
  reversible?: boolean;
  Keq_custom?: number;
  label?: string;
}
```

`CustomSpecies` (the old per-row type) may be removed if unused after the modal rewrite, OR kept
if the modal still uses it internally — your choice, but `params.customReaction` MUST be typed
`CustomReactionNetwork | null` in `src/types/reactor.ts` (`SimulationParams`).

**Rate param keys (per reaction, by rateType):**
- `power-law`: `k`, `Ea`, `T_ref`, optional per-reactant order `n_<species>` (default = reactant
  coeff), and if `reversible`: `Keq`.
- `michaelis-menten`: `Vmax`, `Km` (acts on the reaction's first reactant).
- `langmuir-hinshelwood`: `k`, `K_A`, `K_B` (first and second reactant).

### 2. Math — `src/math/reactionRegistry.ts`

Add `buildCustomNetworkPreset(net: CustomReactionNetwork): ReactionPreset`. Keep all existing
presets. Refactor the existing single-reaction rate-law construction (currently inside
`buildCustomPreset`, lines ~415–441) into a reusable helper `buildRateLawFn(rxn)`, then map it
over the list.

Requirements:
- **Species union:** collect every symbol appearing as a reactant or product across all reactions.
  `buildSpecies()` returns one `Species` per unique symbol. Label = bound compound name if
  `speciesMeta[sym].boundLibraryId` is set, else the symbol.
- **Stoichiometry per reaction:** reactants contribute `−coeff`, products `+coeff`. If a symbol
  appears on both sides, use the **net** coefficient. Every reaction's stoichiometry object must
  include a key for every species in the union (fill non-participants with 0) — match the existing
  preset convention (e.g. Denbigh reactions list all of A,R,S,T,U).
- **Reaction id:** the emitted `Reaction.id` MUST equal `net.reactions[i].id` (so per-reaction ΔH
  lookup works — see §4).
- **Rate law per reaction:** `buildRateLawFn(rxn)` returns a `RateLawFn` using that reaction's
  reactants and `rateParams`, replicating the existing three rate-type formulas exactly:
  - power-law forward: `k_eff · Π C[reactant]^(n_reactant)` with Arrhenius `k_eff` (reuse the
    existing module-local `arrhenius()`), default order = reactant coeff. Reversible subtracts
    `(k_eff / Keq) · Π C[product]^(coeff)`.
  - michaelis-menten: `Vmax·C_A / (Km + C_A)` on first reactant.
  - langmuir-hinshelwood: `k·C_A / (1 + K_A·C_A + K_B·C_B)`.
- `kineticParams: { ...rxn.rateParams }`.
- `isSingle: net.reactions.length === 1`.
- `mode: 'custom'`, `uiLabel` = a compact summary (e.g. first reaction's equation + `(+N more)`).
- Add an optional field `keyReactantId?: string` to the `ReactionPreset` interface and set it from
  `net.keyReactantId ?? (first reactant of reactions[0])`.
- `computeDa: (_k, tau) => (firstReactionK ?? 0.5) * tau` (keep current behavior; Da is informational
  for networks).

Update `getPreset()` so that `reactionMode === 'custom' && customReaction` returns
`buildCustomNetworkPreset(params.customReaction)`. Delete the old `buildCustomPreset` (or keep it
private and unused — prefer delete to avoid dead code).

### 3. Math — `src/math/chemistryFactory.ts`

`buildChemistry` currently hardcodes `keyReactantId: 'A'` and only seeds `B` for series-parallel.
Add a `custom` branch:

```typescript
if (params.reactionMode === 'custom' && params.customReaction) {
  const net = params.customReaction;
  keyReactantId = net.keyReactantId ?? firstReactantOf(net.reactions[0]) ?? 'A';
  initialConcentrations = {};
  for (const [sym, meta] of Object.entries(net.speciesMeta)) {
    if (meta.feedConc && meta.feedConc > 0) initialConcentrations[sym] = meta.feedConc;
  }
}
```

Use the preset's `keyReactantId` if you added it there; either source is acceptable as long as the
key reactant resolves to the first reactant of the first reaction by default. Do NOT add rate-law
logic here — only species/concentration wiring.

### 4. Math — `src/math/thermoModel.ts`

Make `deltaH` return per-reaction values for custom networks, falling back to the global
`params.delta_H`:

```typescript
const dHMap: Record<string, number> = {};
if (params.reactionMode === 'custom' && params.customReaction) {
  for (const rxn of params.customReaction.reactions) {
    if (typeof rxn.deltaH === 'number') dHMap[rxn.id] = rxn.deltaH;
  }
}
return {
  deltaH: (reactionId, _T) => dHMap[reactionId] ?? params.delta_H,
  rhoCp:  (_C, _T) => params.rho_Cp,
};
```

### 5. Serializer — `src/io/serializer.ts`

Follow the existing back-compat pattern (each older field gets a `typeof`/`in` guard with a default).
Add a migration that converts the OLD single-reaction shape to the new network shape:

- If `p.customReaction` is non-null and has a top-level `species` array and NO `reactions` array,
  it is a `LegacyCustomReaction`. Convert it to a one-reaction `CustomReactionNetwork`:
  - `reactions: [{ id: 'cr-1', reactants: <species with role 'reactant'→{species:label,coeff:stoich}>,
    products: <role 'product'>, reversible: old.reversible ?? false, rateType: old.rateType,
    rateParams: { ...old.rateParams, ...(old.Keq_custom ? { Keq: old.Keq_custom } : {}) } }]`
  - `speciesMeta: {}` (all abstract), `keyReactantId: <first reactant label>`.
- If `p.customReaction` is already network-shaped (has `reactions` array) leave it.
- Keep the existing `if (!('customReaction' in p)) → null` guard.

Write the migration as a pure helper `migrateCustomReaction(value: unknown): CustomReactionNetwork | null`
in serializer.ts (serializer.ts is allowed to import types but NOT React/Zustand — keep it pure).

### 6. UI — `src/components/controls/ReactionBuilderModal.tsx` (rewrite)

Rename the modal title to **"Reaction network builder"**. It is rendered via
`createPortal(_, document.body)`. **PRESERVE the backdrop `onMouseDown={(e) => { e.stopPropagation();
if (e.target === e.currentTarget) onClose(); }}`** — the `stopPropagation` is a required bug fix
(without it the parent popover closes the modal on first click). Do not remove it.

**Overall layout (top to bottom), modal width ~720px, max-height 90vh, centered on a dark backdrop:**

A. **Header row.** Left: bold 14px title "Reaction network builder"; below it 11px muted subtitle
   "Type reactions — the network and species build themselves". Right: a ✕ close button.

B. **Presets bar** (keep existing "My Presets" saved-preset chips if present; unchanged behavior).

C. **Two-column body** as a CSS grid `grid-template-columns: 1fr 1fr`, a vertical divider between.

   **LEFT column — "Source" (the ONLY editable surface for topology):**
   - A small uppercase label "Source" with a tiny info-colored pill reading "you edit this".
   - A **multi-line text editor** (a `<textarea>` styled monospace, ~6 rows, light inset
     background, rounded). One reaction per line. The textarea is the single source of truth for
     network topology. Supported syntax, shown in a hint line directly beneath it (10px muted):
     "one reaction per line · `2A + B` for coefficients · `<->` reversible · `A -> R -> S` chains".
   - On every edit, run `parseEquations(textarea.value)` to derive the reaction list and species.
   - Below the hint: a **Rate-law inspector** for the currently selected reaction. Selection =
     the reaction whose line the caret is on, OR a reaction the user clicked in the diagram; default
     to reaction 1. The inspector shows:
       - 10px uppercase caption "Rate law · reaction N (`<pretty equation>`)".
       - A rate-type `<select>`: options "Power law", "Michaelis-Menten", "Langmuir-Hinshelwood".
       - Param inputs depending on type (small 58px monospace number inputs with tiny labels above):
         power-law → `k`, `Ea (kJ/mol)`, `T_ref (K)`, plus one `n_<sym>` per reactant; MM → `Vmax`,
         `Km`; LH → `k`, `K_A`, `K_B`.
       - A "reversible" checkbox; when checked and power-law, also show a `Keq` input.
       - An optional `ΔH (kJ/mol)` input (per reaction).
     Each reaction's rate-law settings persist as the user edits other lines (see "state keying").

   **RIGHT column — "Live preview" (read-only mirror):**
   - A small uppercase label "Live preview" with a muted pill "auto-generated".
   - A **network diagram** rendered as inline SVG from the parsed reactions:
       - Each unique species is a node: a circle (radius ~15) with the species symbol centered in it.
       - Each reaction is one or more directed arrows (line with an arrowhead marker) drawn from
         each reactant node to each product node. A tiny reaction-number label sits near the arrow
         midpoint.
       - **Layout algorithm (deterministic, no physics needed):** compute each species' "depth" =
         length of the longest reactant→product path reaching it from a feed species (a feed species
         is one that never appears as a product). Feeds are depth 0. `x = 24 + depth · 84`. Within a
         depth, stack species vertically: `y = 26 + indexInDepth · 56`. Size the SVG viewBox to fit.
       - Highlight the **selected** reaction's arrow(s) in the info/accent color; others muted gray.
       - Colors MUST come from CSS variables (`var(--bg-surface)`, `var(--text-primary)`,
         `var(--accent)`, `var(--text-secondary)`, `var(--border-mid)`) so it works in dark mode.
   - Clicking an arrow selects that reaction (drives the left inspector).

D. **Species strip** (full width, below the two columns, separated by a top border):
   - 10px uppercase label "Species" + muted pill "found in equations".
   - A flex-wrap row of **species chips**, one per unique symbol from the parse. Each chip contains:
       - the symbol (monospace, 12px, bold),
       - a "bind compound…" `<select>` populated from the species library (reuse the existing
         `allSpeciesIds`/`getSpecies` imports already in this file) — selecting binds
         `speciesMeta[sym].boundLibraryId`,
       - a phase tag select or pill (g / l / s) → `speciesMeta[sym].phase`,
       - a small feed-concentration number input labeled "feed (mol/L)" → `speciesMeta[sym].feedConc`.
         Only meaningful for feed species but show for all; default empty/0.

E. **Footer row** (top border):
   - Left: a validation summary. When valid (≥1 reaction, every reaction has ≥1 reactant and ≥1
     product, all coeffs > 0, species symbols are valid identifiers): success-colored text like
     "4 reactions · 5 species". When invalid: danger-colored text naming the first problem
     (e.g. "Reaction 2 has no product").
   - Right: a "+ Save as preset" button (keep existing localStorage preset behavior, saving the new
     network shape), a "Cancel" button (calls `onClose`), and a primary "Save network" button.

**Save behavior:** assemble a `CustomReactionNetwork` from the parsed reactions + per-reaction
rate-law state + speciesMeta, then call
`updateParams({ customReaction: net, reactionMode: 'custom' })` and `onClose()`. Disable
"Save network" when the validation summary is in the error state.

**Open/round-trip behavior:** when the modal opens:
   - If `params.customReaction` is already a network, prefill the textarea from its reactions
     (render each as `aA + bB -> cC + dD`, using `<->` when reversible), and prefill rate-law state
     and speciesMeta from it.
   - Else if the active `reactionMode` is a canned preset (series, parallel, denbigh, series3,
     series-parallel, single), prefill the textarea via `presetToText(params.reactionMode)` and seed
     per-reaction rate params from `params.k, k2, k3, k4` in line order. This makes "select a preset,
     click Edit" load that reaction as editable text. (`presetToText` already exists — reuse it.)

**State keying (so rate-law edits survive topology edits):** keep a `Record<reactionKey, {rateType,
rateParams, reversible, Keq, deltaH}>` where `reactionKey` is the reaction's normalized signature
(sorted reactants + arrow + sorted products, e.g. `"A->R"`). When the parse changes, match each
parsed reaction to existing state by signature; unmatched reactions default to power-law with
`{k:0.5, Ea:0, T_ref:300}`. Assign stable `id`s (`cr-1`, `cr-2`, …) at save time in line order.

---

## DO's
- Reuse `parseEquations`, `presetToText`, `arrhenius`, `allSpeciesIds`, `getSpecies`.
- Keep all changes to kinetics/rate-law construction inside `reactionRegistry.ts`.
- Add serializer back-compat with `typeof`/`in` guards AND the legacy→network migration.
- Use CSS variables for every color in the modal and SVG so dark mode works.
- Preserve the backdrop `e.stopPropagation()` in `onMouseDown`.
- Keep `src/math/**` and `src/io/serializer.ts` free of React/Zustand imports (purity test enforces this).
- Write golden equivalence tests (see below). Keep the total test count strictly non-decreasing.
- Run `npx vitest run` (all pass) and `npm run build` (exit 0) before declaring done.

## DON'Ts
- DO NOT modify `networkSolver.ts`, `unitModels.ts` math, `netProductionRate`, or the `ChemistryModel`/
  `Reaction`/`RateLawFn` interfaces. The solver is already general.
- DO NOT add `reactionMode === 'custom'` or `kinetics ===` rate-law branching anywhere except
  `reactionRegistry.ts` (the species/conc wiring in `chemistryFactory.ts` and `thermoModel.ts`
  specified above is the only allowed exception, and it must contain NO rate-law logic).
- DO NOT introduce a second editable surface for topology. The textarea is the single source of
  truth; the diagram and species chips are read-only mirrors (chips edit only binding/phase/feed
  metadata, never topology).
- DO NOT remove the modal's `e.stopPropagation()` backdrop fix.
- DO NOT break existing saves — old single-reaction custom files must load and solve.
- DO NOT add new npm dependencies. Use inline SVG for the diagram (no graph library).

---

## Tests — `src/math/__tests__/customNetwork.test.ts` (new)
Hand-calculated or preset-equivalence golden tests. At minimum:

1. **Denbigh equivalence:** build a `CustomReactionNetwork` for A→R, A→T, R→S, R→U with the same
   k₁..k₄ used by the canned Denbigh preset, run an isothermal CSTR (or Batch) via the SAME code path
   the app uses, and assert species concentrations match the canned `denbighPreset` result within
   1e-6.
2. **Parallel equivalence:** A→R, A→S custom network === `parallelPreset` (within 1e-6).
3. **Series equivalence:** A→R→S custom network === `seriesPreset` (within 1e-6).
4. **Stoichiometry net coefficient:** a reaction `2A + B -> C` yields stoichiometry
   `{A:-2, B:-1, C:+1}` for every species in the union.
5. **Per-reaction ΔH:** a two-reaction network with `deltaH` set on reaction 2 only returns that
   value from `thermo.deltaH('cr-2', T)` and `params.delta_H` for reaction 1.
6. **Serializer migration:** a legacy single-reaction `customReaction` JSON deserializes into a
   one-reaction `CustomReactionNetwork` with the correct reactants/products and a non-null
   `reactions[0].id`.

Add a brief comment above each assertion stating the expected value and where it comes from.

---

## Definition of done
- `npx vitest run` — all tests pass, count ≥ previous count.
- `npm run build` — exits 0.
- Typing the Denbigh system into the builder and solving a reactor gives the same numbers as the
  built-in Denbigh preset.
- Old saved flowsheets with single-reaction custom reactions still load and solve.
- The modal shows: editable text source (left), live network diagram + species chips (read-only
  mirrors), per-reaction rate-law inspector, and a validation summary. No second editable topology
  surface.
