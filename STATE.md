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

---

## Last session (stage 5 — resume here, don't restart)

**2026-06-14** · Phase 9 — F20 complete. All 175 tests pass. Build clean.

- F20: Engineering Stream Table & HMB Report
  - `src/math/streamTableMapper.ts` (new — pure math: buildHMBTable, hmbTableToCSV, hmbTableToMarkdown)
  - `src/math/__tests__/streamTableMapper.test.ts` (new — 14 golden tests)
  - `src/components/panels/StreamTablePanel.tsx` (updated — Solver ↔ HMB toggle, HMBView component)

**Next:** F21 — P&ID / PFD Mode (`docs/FEATURE_PROPOSALS.md` §21).

## Verified facts (additions from F20)
- `AnnotatedStream` must be cast via `unknown` before `Record<string,unknown>` — TypeScript won't allow direct overlap cast (`as Record` fails; use `as unknown as Record`).
- `FALLBACK_MW = 100 g/mol` for generic species A, R, S, T, U (not in speciesLibrary.json).
- Generic species excluded from atom balance (no molecular formula) but included in mass balance via FALLBACK_MW.
- Feed edge IDs: edges where `nodes.find(n => n.id === e.source)?.type === 'feed'`.
- Product edge IDs: edges where the target node has no outgoing edges (out-degree = 0).
