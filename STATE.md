# STATE.md · reaction-simulator
> Read this at the start of every session. Write to it before closing every session.
> This is the project's operational memory — verified facts, accumulated rules, open work.

---

## Verified facts (stage 3 — stop re-deriving these)

- `pfrModel` ODE index layout in `cooled-detailed` mode: `TIdx = speciesIds.length`, `TcIdx = TIdx+1`, `PIdx = TIdx+2`
- `kappa_v_eff` formula for NTU/ε jacket: `(mCp * eps) / V` — NOT `(UA * eps) / V` (bug caught F17)
- `bisect()` T range for CSTR cooled-detailed must anchor below Tc: `T_lo = max(200, min(Tc-50, T_in-300))`. Range `[T_in, T_in+600]` fails when cooling brings T_out < T_in.
- Counter-current PFR BVP: BC is `Tc(tau) = Tc_in`. Bisect on `Tc(0)`. ODE sign for dTc/dτ = −1.
- `catalyticPFR` applies η via `scaledChemistry` wrapper — never mutates `chemistry.reactions` directly.
- `segregationConversion` for 2nd-order kinetics (n>1): X_seg > X_CSTR. Counter-intuitive but verified. (CSTR quadratic: discriminant = 9, not 17 — bug caught F19.)
- `ChemistryModel.reactions[].label` is a required field. Test stubs that omit it fail `tsc`.
- `effectivenessFactor(φ)` at φ=100 gives 0.0297, not 0.03 (asymptote 3/φ is approximate). Use φ≥1000 for tight tolerance tests.
- Purity invariant: `src/math/` + `src/io/serializer.ts` must have zero React/Zustand runtime imports. Enforced by `purity.test.ts`.

---

## General rules (stage 4 — consult before implementing)

- Every new unit node checklist (in order, no skipping):
  1. Add type to `UnitType` union in `src/types/simulation.ts`
  2. Write pure model function in `src/math/unitModels.ts` (or own file if >100 lines)
  3. Add `forwardPass` dispatch branch in `src/math/networkSolver.ts`
  4. Add Canvas component in `src/components/canvas/` (copy smallest existing node)
  5. Add toolbar button in `src/components/controls/ReactorToolbar.tsx`
  6. Add serializer migration in `deserializeState()` with safe defaults for old saves
  7. Write ≥1 golden test with hand-calculated expected value in a comment above the assertion
- `getPreset()` is the **only** kinetics branching point. Never add `params.kinetics ===` checks outside `src/math/reactionRegistry.ts`.
- `bisect()` range must bracket the root — always reason about the direction of heat/mass transfer before setting bounds.
- Back-compat migrations: every new node field needs a `typeof d.field === 'type' ? d.field : default` guard in `deserializeState()`.
- ProcessStream `{ F: Record<SpeciesId, number>, T: number, P: number }` is the primary solver currency. Never use Ca/Cr/Cs in solver signatures.
- Tear-stream convergence norm: `‖ΔF‖_∞` over molar flows.

---

## Open failures → investigate next session (stages 1–2)

- F19.3: η not yet displayed on `FixedBedNode` canvas component. Low priority but filed.
- (add new failures here before closing session — include reproduction steps)

---

## Lessons learned (stage 4 distillations — bugs that burned time)

| Session | Lesson |
|---------|--------|
| F17 | CSTR bisect T_lo: cooling brings T_out below T_in. Bracket must go below Tc, not start at T_in. |
| F17 | kappa_v_eff = mCp·ε/V derived from Q̇ = ṁ_c·Cp_c·ε·(T−Tc_in), not from UA directly. |
| F18 | TypeScript: test stubs for ChemistryModel need `label` field on reaction objects. |
| F19 | 2nd-order CSTR quadratic: `2X²-5X+2=0` has discriminant 9 (not 17). X_CSTR = 0.5. |
| F19 | Segregation direction for n>1: isolated clumps react at higher local Ca → X_seg > X_CSTR. |
| F19 | η asymptote test: use φ=1000 (function returns 3/φ exactly above threshold), not φ=100 (1% error from coth). |
| F22 | `Stream` lives in `types/stream.ts`, NOT `types/simulation.ts`. Vitest strips `import type` so tests pass; tsc fails. Always verify import path against the build. |
| F22 | Turton S range: comp Smin=450 kW (centrifugal). Small lab compressors (<450 kW) will always be clamped — set clamped flag, never extrapolate silently. |
| F22 | Flash drum vapor outlet identified by `sourceHandle === 'out-vapor'`; fallback to inlet stream (conservative upper bound on drum size) when vapor edge not in streams. |
| F23 | `SimulationParams` is in `types/reactor.ts`, NOT `types/simulation.ts`. Vitest swallows `import type` errors; tsc does not. |
| F23 | NM in 1D reduces to a 2-vertex line search. Works correctly for convex functions but may need more iterations than expected. |
| F23 | `buildObjective` must snapshot nodes/edges/params from store at run start (not inside the callback closure) to avoid stale-closure bugs if user edits the flowsheet mid-run. |
| F24 | Cantera YAML inRateConst block: exit condition must use `lvl <= rateConstLvl` on raw indent, not stripped lines. |
| F24 | Ea unit conversion: Cantera default = cal/mol; internal = J/mol; export = cal/mol. Round-trip: Ea → /4.184 → export → ×4.184 → import ≈ original (±0.001 J/mol fp error). |
| F24 | `src/io/` (other than serializer.ts) is NOT subject to the purity test. Canterbury importer/exporter may import Node types but must not import React/Zustand. |

---

## Last session (stage 5 — resume here, don't restart)

**2026-06-14** · Phase 10 — ALL 34 FEATURES COMPLETE. 222 tests pass. Build clean.

- F28 (Resizable Layout): `sessionSlice` gains `rightColWidth`/`graphHeight`/`graphCollapsed`. `App.tsx`: horizontal drag handle (canvas ↔ right col), vertical drag handle (graph section ↔ stream table), ▼/▲ collapse chevron in tab bar.
- F29 (Stream Table Full Height): stream table wrapper → `flex:1 min-h:0 overflow-y:auto` (done together with F28).
- F30 (Cursor Sticking Fix): `onMouseDown={e => e.stopPropagation()}` on thermal mode `<select>` in `CSTRNode`, `PFRNode`, `BatchNode`.
- F31 (Remove Mode/Kinetics Bar): `ParameterPanel.tsx` rewritten — removed HoverDropdown + Mode/Kinetics dropdowns; now shows compact mode·kinetics label chip + Edit Reaction button for custom.
- F32 (Node Label Da Format): CSTR/PFR/Batch already showed `Da:X.XX`. Added `W/F:X.X` to `FixedBedNode` header using `W_cat/(Ca0·Q_feed)`.
- F33 (Canvas Toolbar): `src/components/canvas/CanvasToolbar.tsx` (new) — Save/Load/Examples/Export/Undo/Redo strip above canvas. File I/O removed from `ReactorToolbar.tsx`.
- F34 (Blender-Inspired UX): Dark mode toggle (Sun/Moon button) added to `CanvasToolbar` via `useTheme`. CSS variables + hook were pre-existing. Other sub-items (inline editing, keyboard shortcuts, context-sensitive panel) were already present.
- F1-F9 IMPLEMENTED markers added (pre-loop Phase 1-5 features, already in codebase).

**2026-06-14 (cont.)** · F35 — Custom Multi-Reaction Network Builder. 229 tests pass. Build clean.

- `CustomReactionNetwork` / `CustomNetworkReaction` / `LegacyCustomReaction` added to `types/simulation.ts`. `params.customReaction` re-typed in `reactor.ts`.
- `buildCustomNetworkPreset(net)` added to `reactionRegistry.ts`; old single-reaction `buildCustomPreset` removed. `getPreset()` routes `custom` mode through the new function.
- `chemistryFactory.ts`: custom branch sets `keyReactantId` from network + seeds `initialConcentrations` from `speciesMeta[sym].feedConc`.
- `thermoModel.ts`: `deltaH(reactionId)` now returns per-reaction `rxn.deltaH` for custom networks, falling back to global `params.delta_H`.
- `serializer.ts`: `migrateCustomReaction()` converts old single-reaction shape → one-reaction `CustomReactionNetwork`. Old saves still load.
- `ReactionBuilderModal.tsx` rewritten: two-column layout (textarea left / SVG network diagram right), per-reaction rate-law inspector, species-strip binding, presets round-trip via `presetToText`. Single source of truth = textarea.
- 7 new golden equivalence tests in `customNetwork.test.ts`: Denbigh/parallel/series custom === preset (within 1e-6), stoich, per-reaction ΔH, serializer migration.

**Verified invariants:** purity (0 React/Zustand in math/), `getPreset()` is only rate-law branch, `reactionMode` checks in networkSolver are display-only (Levenspiel/operating diagram), solver untouched.

**Next:** No more features in FEATURE_PROPOSALS.md — all 34 are IMPLEMENTED. Loop complete.

- F22: Equipment Sizing & Cost Estimation
  - `src/math/sizing.ts` (new — pure: computeSizing, vesselGeom ASME, Souders-Brown flash, sizeCSTR/PFR/FB/Batch/HX/Flash/Pump/Comp)
  - `src/math/costing.ts` (new — pure: costNode Turton log₁₀, calcEP Douglas EP formula, CEPCI scaling)
  - `src/math/__tests__/sizing.test.ts` (new — 10 golden tests)
  - `src/math/__tests__/costing.test.ts` (new — 7 golden tests)
  - `src/components/panels/EquipmentPanel.tsx` (new — equipment table + EP calculator with editable prices)
  - `src/App.tsx` (updated — DesignView += 'sizing', "Sizing" seg-ctrl button, render EquipmentPanel)
  - Bug fixed: sizing.ts, sizing.test.ts imported Stream from types/simulation (missing) — corrected to types/stream.

- F23: Optimisation Engine
  - `src/math/optimizer.ts` (new — pure: initSimplex, stepNM, nelderMead; box-constrained NM ~130 lines)
  - `src/math/__tests__/optimizer.test.ts` (new — 8 golden tests: 1D, 2D, constrained, Infinity, Rosenbrock)
  - `src/hooks/useOptimizer.ts` (new — async driver with 10-iter chunk yield; OPTIM_SCHEMA, extractObjectiveValue)
  - `src/components/panels/OptimiserPanel.tsx` (new — variable checklist, objective/maximize toggle, convergence sparkline, result card + Apply button)
  - `src/App.tsx` (updated — DesignView += 'optimise', 4th seg-ctrl button, shortened all labels)
  - Bug fixed: SimulationParams lives in types/reactor.ts, not types/simulation.ts.

- F24: Interoperability
  - `src/io/canteraImporter.ts` (new — pure: parseCantYaml, line-by-line YAML parser for Cantera subset)
  - `src/io/canteraExporter.ts` (new — pure: toCanteraYaml, paramsToCanteraYaml with Ea J/mol↔cal/mol)
  - `src/math/__tests__/interop.test.ts` (new — 13 golden tests: species, reactions, Ea units, round-trip)
  - `docs/schema/flowsheet.schema.json` (new — JSON Schema for flowsheet save format, version 1)
  - `src/hooks/useInterop.ts` (new — useExportCantera, useImportCantera file I/O hooks)
  - `src/components/controls/ReactorToolbar.tsx` (updated — "Cantera YAML — Export/Import" in dropdown)

**Next:** F25 — Context Menu: Single-Click Open, Click-Away Close (`docs/FEATURE_PROPOSALS.md` §25).

## Verified facts (additions from F22)
- `computeSizing` is downstream-only: reads converged `result.streams`, never feeds back to solver. Sizing panel is pure display.
- Turton keys: vessel (cstr/pfr/fixedbed/batch/semibatch/flash), hx, pump, comp, valve. CEPCI_REF=397 (2001 Turton edition).
- AACE Class-5 EP formula: `totalModule = 1.18 × Σ C_BM`; `annualCapital = totalModule / plant_life_yr`. Douglas methodology.
- Flash vapor outlet resolved via `edge.sourceHandle === 'out-vapor'` after solver run.
- `EquipmentPanel` uses local component state for economic params (cepci, prices) — not persisted to store (display-only).

## Verified facts (additions from F21)
- PFD node components must replicate exact Handle IDs from schematic nodes (id="in", id="out", id="out-vapor", id="out-liquid", id="in1", id="in2", id="out-top", id="out-bot", id="out-vent", id="out-process") or edges disconnect on toggle.
- `_pfdTag` injection pattern: compute tags in ReactorCanvas useMemo, map over nodes to add `data: { ...n.data, _pfdTag: tags[n.id] }` — never written to store.
- pfdEdgeTypes must be defined OUTSIDE ReactFlow render (const at module level or stable memo) — inline object definition causes edge flickering every render.
- `EdgeLabelRenderer` from @xyflow/react enables absolutely-positioned HTML overlays on edges (stream diamond labels).
- AnnotatedStream cast via `unknown` before Record (same pattern as F20).
- Feed edge IDs: edges where `nodes.find(n => n.id === e.source)?.type === 'feed'`.
- Product edge IDs: edges where target node has out-degree = 0.

## Verified facts (additions from F20)
- `AnnotatedStream` must be cast via `unknown` before `Record<string,unknown>` — TypeScript won't allow direct overlap cast (`as Record` fails; use `as unknown as Record`).
- `FALLBACK_MW = 100 g/mol` for generic species A, R, S, T, U (not in speciesLibrary.json).
- Generic species excluded from atom balance (no molecular formula) but included in mass balance via FALLBACK_MW.
- Feed edge IDs: edges where `nodes.find(n => n.id === e.source)?.type === 'feed'`.
- Product edge IDs: edges where the target node has no outgoing edges (out-degree = 0).
