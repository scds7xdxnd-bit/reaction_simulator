# Reaction Simulator — Architecture & Verification Guide

> **Audience:** Chemical engineering student building and extending this tool.  
> This document covers every layer of the codebase and provides 10 hand-solvable test cases to
> verify that the simulator is producing physically correct answers.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Directory Structure](#3-directory-structure)
4. [Data Flow: From Click to Answer](#4-data-flow-from-click-to-answer)
5. [Type System](#5-type-system)
6. [Math Layer — Core Engine](#6-math-layer--core-engine)
   - 6.1 Reaction Registry & Presets
   - 6.2 Chemistry Factory
   - 6.3 Thermo Model
   - 6.4 Unit Models (CSTR, PFR, Semibatch, FixedBed)
   - 6.5 Numerics
   - 6.6 Network Solver & Recycle Algorithm
   - 6.7 Topology (Tear Edges, Topo Sort)
   - 6.8 Levenspiel Curve & RTD
   - 6.9 Operating Diagram
   - 6.10 Gas-Phase Factor & Pressure Drop
   - 6.11 Sweep, Target, Comparison Engines
   - 6.12 Dynamic Engine
7. [Supported Reaction Modes](#7-supported-reaction-modes)
8. [Supported Reactor Types & Thermal Modes](#8-supported-reactor-types--thermal-modes)
9. [State Management (Zustand)](#9-state-management-zustand)
10. [UI Components](#10-ui-components)
11. [I/O Layer](#11-io-layer)
12. [Architectural Invariants](#12-architectural-invariants)
13. [10 Verification Test Cases](#13-10-verification-test-cases)

---

## 1. Project Overview

The Reaction Simulator is a browser-based, single-page web application that lets users
visually construct reactor networks by dragging and connecting nodes on an interactive canvas.
The simulation engine then solves the reactor design equations in real time and displays
conversion, selectivity, yield, species profiles, Levenspiel plots, operating diagrams, RTDs,
and transient responses.

Core educational use cases:
- Comparing CSTR vs. PFR performance at the same space time
- Exploring recycle loops and their convergence
- Finding the optimal space time for series/parallel reaction networks
- Visualizing multiple steady states in non-isothermal CSTRs
- Understanding how gas-phase expansion (ε) changes the design equation

---

## 2. Technology Stack

| Layer | Library / Tool | Version |
|-------|---------------|---------|
| UI framework | React | 18.3 |
| Language | TypeScript | 5.5 |
| Build tool | Vite | 5.4 |
| Canvas/flowsheet | @xyflow/react | 12.3 |
| State management | Zustand | 5.0 |
| Charting | Recharts | 2.12 |
| Styling | Tailwind CSS | 3.4 |
| Testing | Vitest | 2.1 |
| Export (image) | html-to-image | 1.11 |

The math layer has **zero** React or Zustand imports. Every function in `src/math/` is pure
TypeScript that can be called directly from unit tests.

---

## 3. Directory Structure

```
src/
├── types/
│   ├── chemistry.ts       Core interfaces: Species, Reaction, ChemistryModel, ThermoModel, RateLawFn
│   ├── simulation.ts      Union types: KineticsType, ReactorType, ReactionMode, ThermalMode, RateType, CustomReaction
│   ├── reactor.ts         SimulationParams, ReactorNodeData, NetworkResult, SimulationResult
│   └── stream.ts          Stream, AnnotatedStream, utility fns (totalMolarFlow, conversion …)
│
├── math/                  ← Pure math, zero framework imports
│   ├── reactionRegistry.ts    SOLE branching point on reactionMode/kinetics; getPreset()
│   ├── chemistryFactory.ts    buildChemistry() → ChemistryModel
│   ├── thermoModel.ts         buildThermoModel() → constant ΔH, ρCp
│   ├── unitModels.ts          cstrModel, pfrModel, sideFeedPFR, catalyticPFR
│   ├── networkSolver.ts       solveNetwork() — main entry point for steady-state solve
│   ├── topology.ts            findTearEdgeIds() (DFS), topoSort() (Kahn's), reachableFrom/To()
│   ├── numerics.ts            bisect() (60-step), rk4Step() — pure math utilities
│   ├── kinetics.ts            getRate(), buildLevenspielCurve()
│   ├── dynamicEngine.ts       runDynamicStep() — transient CSTR ODE integration
│   ├── operatingDiagramModel.ts  Heat-gen/removal curves, multiple steady states
│   ├── gasPhaseFactor.ts      gasPhaseConc(), cstrGasPhaseXa(), pfrGasPhaseODE()
│   ├── pressureDropModel.ts   Ergun equation: dP/dτ
│   ├── equilibrium.ts         computeXeq(Keq) = Keq/(1+Keq)
│   ├── rtdModel.ts            computeRTD() — TIS, CSTR, PFR exit age distributions
│   ├── semibatchModel.ts      semibatchSolve() — variable-volume ODE
│   ├── sweepEngine.ts         runSweep() — parametric study
│   ├── targetSolver.ts        Find τ (or k) to hit a target conversion
│   ├── comparisonEngine.ts    Side-by-side CSTR vs PFR comparison
│   ├── steadyStateMapper.ts   Map operating-diagram intersection → Xa, T
│   ├── streamBridge.ts        StreamState ↔ Stream conversions, annotateStream()
│   └── formatEquation.ts      Renders stoichiometry as readable strings
│
├── store/
│   ├── simulatorStore.ts      Single Zustand store combining all slices
│   └── slices/
│       ├── topologySlice.ts   nodes[], edges[] (React Flow state)
│       ├── paramsSlice.ts     SimulationParams (default values live here)
│       ├── resultSlice.ts     SimulationResult | null
│       ├── sessionSlice.ts    Session metadata, scenario history
│       ├── toastSlice.ts      Notification queue
│       ├── sweepSlice.ts      Sweep config & results
│       └── plotConfigSlice.ts Plot axis & display settings
│
├── hooks/
│   ├── useSimulation.ts       Reactively calls solveNetwork() on param/topology change
│   ├── useDynamicSimulation.ts  Drives runDynamicStep() frame-by-frame
│   ├── useScenarios.ts        Save/restore named scenarios
│   ├── useFileIO.ts           JSON export/import via serializer
│   ├── useValidation.ts       Wraps validateParams + validateTopology, exposes ValidationContext
│   ├── useExport.ts           PNG/SVG export via html-to-image
│   ├── useClipboardActions.ts Copy/paste nodes
│   └── useReactorNode.ts      Per-node data mutations
│
├── components/
│   ├── canvas/                ReactFlow node renderers
│   │   ├── FeedNode.tsx, ProductNode.tsx
│   │   ├── CSTRNode.tsx, PFRNode.tsx, BatchNode.tsx, SemibatchNode.tsx, FixedBedNode.tsx
│   │   ├── MixerNode.tsx, SplitterNode.tsx
│   │   ├── ReactorCanvas.tsx  Main <ReactFlow> wrapper
│   │   └── CanvasAddMenu.tsx, CanvasContextMenu.tsx, ContextMenu.tsx
│   ├── controls/
│   │   ├── ParameterPanel.tsx     Global param sliders/inputs
│   │   ├── ParameterPopover.tsx   Per-node parameter editor
│   │   ├── ReactionBuilderModal.tsx  Custom reaction builder UI
│   │   ├── DynamicControls.tsx    Disturbance controls for dynamic simulation
│   │   └── ReactorToolbar.tsx     Add-node toolbar
│   ├── panels/
│   │   ├── PropertiesPanel.tsx
│   │   ├── ScenariosPanel.tsx
│   │   ├── SelectivityPanel.tsx
│   │   └── StreamTablePanel.tsx
│   ├── plots/
│   │   ├── LevenspielPlot.tsx     1/(-rA) vs Xa
│   │   ├── OperatingDiagram.tsx   G(T) vs R(T) for non-isothermal CSTR
│   │   ├── ConversionProfile.tsx  Xa vs cumulative τ
│   │   ├── DynamicResponse.tsx    Xa(t), T(t) dynamic curves
│   │   ├── PhasePortrait.tsx      T vs Xa phase plane
│   │   ├── RTDPanel.tsx           E(t) for TIS / CSTR / PFR
│   │   ├── RecyclePanel.tsx       Iteration convergence history
│   │   ├── SpeciesProfile.tsx     Ca, Cr, Cs vs τ
│   │   ├── TemperatureProfile.tsx T vs τ along PFR
│   │   └── SweepPanel.tsx         Xa or YR vs swept parameter
│   └── ui/                    Primitive components (Button, Input, Select, Slider …)
│
├── io/
│   ├── serializer.ts          serializeState() / deserializeState() with version migration map
│   └── examples.ts            Hard-coded EXAMPLES[] array for quick-start scenarios
│
├── context/
│   └── ValidationContext.tsx  React context providing live validation issues
│
└── schema/
    └── parameterSchema.ts     Parameter validation schema
```

---

## 4. Data Flow: From Click to Answer

```
User drags slider / changes τ on a node
        │
        ▼
 Zustand store update (paramsSlice or topologySlice)
        │
        ▼
 useSimulation hook subscribes to store changes
        │
        ▼
 buildChemistry(params)              ← chemistryFactory.ts
   └─ getPreset(params)              ← reactionRegistry.ts (sole branching point)
       └─ buildSpecies(), buildReactions(), rateLaw closures assembled
        │
        ▼
 solveNetwork(nodes, edges, params)  ← networkSolver.ts
   1. Validate: feed node + product node reachable
   2. findTearEdgeIds(nodes, edges)  ← topology.ts (DFS back-edge detection)
   3. topoSort(nodes, edges, tearIds) ← topology.ts (Kahn's BFS)
   4. Initialise tear-stream guesses (Xa=0, Ca=Ca0)
   5. RECYCLE LOOP (≤200 iterations, 50% damping, tol=1e-6):
      a. forwardPass() — visit nodes in topoOrder:
         • feed  → StreamState with Ca0, T_feed
         • cstr  → cstrModel(inlet, params, chemistry)   ← unitModels.ts
         • pfr   → pfrModel(inlet, params, chemistry)    ← unitModels.ts
         • mixer → weighted-average mix of all inlet edges
         • splitter → split by α; two outgoing streams
         • product → pass-through (records final state)
      b. Compute max error on tear edges (ΔXa, ΔCa, ΔT/300)
      c. Damp: new_guess = 0.5·old + 0.5·computed
   6. buildSegments() → ReactorSegmentResult[] with profiles
   7. buildLevenspielCurve(params)
   8. buildOperatingDiagram() for cooled CSTRs in single mode
   9. selectivityAnalysis (Da_opt, YR curve) for series/parallel modes
  10. computeXeq(Keq) for reversible mode
        │
        ▼
 SimulationResult written to resultSlice
        │
        ▼
 All plot components re-render from result (Recharts)
```

---

## 5. Type System

### `ChemistryModel` — the chemistry contract

```typescript
interface ChemistryModel {
  species: Species[];                    // ordered list, ids used as map keys
  reactions: ReactionSet;                // each reaction has a RateLawFn closure
  thermo: ThermoModel;                   // deltaH(reactionId, T), rhoCp(C, T)
  keyReactantId: SpeciesId;              // always 'A' — drives Xa calculation
  initialConcentrations?: Record<...>;   // seed co-reactants (e.g. B in series-parallel)
}
```

### `SimulationParams` — the global parameter object

| Field | Units | Role |
|-------|-------|------|
| `reactionMode` | — | Picks preset from registry |
| `kinetics` | — | Sub-selects single-reaction preset |
| `k` | s⁻¹ or L·mol⁻¹·s⁻¹ | Rate constant (reaction 1) at T_ref |
| `k2`, `k3`, `k4` | same | Rate constants for reactions 2–4 |
| `Cb0` | mol/L | Initial B concentration (series-parallel) |
| `Keq_ref` | — | Equilibrium constant at T_ref |
| `Ca0` | mol/L | Feed concentration of A |
| `Cr0_fraction` | — | Initial R seed fraction for autocatalytic |
| `T_ref` | K | Reference temperature for Arrhenius |
| `Ea` | kJ/mol | Activation energy |
| `delta_H` | kJ/mol | Heat of reaction (negative = exothermic) |
| `rho_Cp` | kJ/(L·K) | Volumetric heat capacity |
| `T_feed` | K | Feed temperature |
| `epsilon` | — | Gas-phase expansion factor |
| `Q_feed` | L/s | Volumetric feed flow (used only for volume display) |
| `customReaction` | — | Full custom reaction spec or null |

### `StreamState` — internal stream representation

```typescript
interface StreamState {
  Xa: number;   // fractional conversion of A [0, 1)
  Ca: number;   // concentration of A [mol/L]
  Cr: number;   // concentration of R [mol/L]
  Cs: number;   // concentration of S [mol/L]
  flow: number; // normalised volumetric flow (relative to fresh feed = 1)
  T: number;    // temperature [K]
}
```

Conversion between `Stream` (molar flows F[species]) and `StreamState` is handled
exclusively by `src/math/streamBridge.ts`.

---

## 6. Math Layer — Core Engine

### 6.1 Reaction Registry & Presets (`reactionRegistry.ts`)

`getPreset(params)` is the **single** function that branches on `reactionMode`/`kinetics`.
No other file contains `params.kinetics ===` or `params.reactionMode ===` logic.

Each `ReactionPreset` provides:
- `buildSpecies(params)` — species list
- `buildReactions(params)` — array of `Reaction` with closed-over `rateLaw`
- `computeDa(k, tau, Ca0)` — Damköhler number for the Levenspiel plot

Presets shipped:

| id | Equation | Da definition |
|----|----------|--------------|
| `single-first-order` | A → R | Da = k·τ |
| `single-second-order` | A → R | Da = k·Ca0·τ |
| `single-autocatalytic` | A → R (k·Ca·(Cr+Cr0)) | Da = k·Ca0·τ |
| `single-reversible` | A ⇌ R | Da = k·τ |
| `single-gas-phase-1st-order` | A → R (gas) | Da = k·τ |
| `series` | A→R→S | Da = k·τ |
| `parallel` | A→R, A→S | Da = k·τ |
| `series-parallel` | A+B→R+B→S+B→T | Da = k·Ca0·τ |
| `series3` | A→R→S→T | Da = k·τ |
| `denbigh` | A→R/T, R→S/U | Da = k·τ |
| `custom` | user-defined | Da = rp['k']·τ |

Arrhenius temperature dependence is applied uniformly:

```
k_eff(T) = k · exp( (Ea/R) · (1/T_ref − 1/T) )     [R = 8.314×10⁻³ kJ/(mol·K)]
```

Exponent is clamped to [−30, 30] to prevent overflow.

### 6.2 Chemistry Factory (`chemistryFactory.ts`)

```typescript
buildChemistry(params) → ChemistryModel
```

Calls `getPreset(params)`, then adds a `ThermoModel` and optionally seeds
`initialConcentrations` (only for `series-parallel` mode, where B starts at `Cb0`).

### 6.3 Thermo Model (`thermoModel.ts`)

Returns constant `deltaH` and `rhoCp` (both uniform across all reactions and temperatures).
The interface is structured so that per-reaction ΔH values and polynomial Cp can be added
later without touching any caller.

Energy balance used in the CSTR:

```
T_out = [ρCp·T_in + κ_v·τ·Tc + (−ΔH)·Σ(rᵢ·τ)] / [ρCp + κ_v·τ]    (cooled)
T_out = T_in + (−ΔH)·Σ(rᵢ·τ) / ρCp                                   (adiabatic)
```

Energy balance used in the PFR:

```
dT/dτ = [(−ΔH)·rₐ − κ_v·(T−Tc)] / ρCp                               (cooled)
dT/dτ = (−ΔH)·rₐ / ρCp                                                (adiabatic)
```

### 6.4 Unit Models (`unitModels.ts`)

**`cstrModel`**

Single-reaction (isothermal): uses **bisection** on the CSTR residual
```
f(Ca_out) = (Ca_in − Ca_out)/τ − r(Ca_out, T) = 0
```
Multi-reaction (isothermal): uses **fixed-point iteration** with 50% damping:
```
C_new[i] = C_in[i] + τ · (net production rate)
C[i]     = 0.5·C_new[i] + 0.5·C[i]    (damped update)
```
Non-isothermal single-reaction: outer bisection on T_out; inner CSTR solve at each T trial.

**`pfrModel`**

Integrates the PFR ODE system using 200-step **RK4**:
```
dC[i]/dτ = stoich[i] · r(C, T)
dT/dτ    = [(−ΔH)·r − κ_v·(T−Tc)] / ρCp     (or 0 for isothermal)
dP/dτ    = −β₀·u₀                             (Ergun, only if pressureDrop=true)
```
State vector: `[Ca, Cr, Cs, …, T, P?]`, 200 steps of size `h = τ/200`.

**Gas-phase isothermal path (both CSTR and PFR)**

For `kinetics = 'gas-phase-1st-order'`, a dedicated code path is used:
```
Ca = Ca0·(1−Xa)/(1+ε·Xa)

CSTR: solve  ε·Xa² + (1+Da)·Xa − Da = 0  (quadratic, positive root)
PFR:  integrate  dXa/dτ = k·(1−Xa)/(1+ε·Xa)  via RK4
```

**`semibatchModel`**

Integrates mole balances for a variable-volume system with continuous B feed:
```
dNᵢ/dt = Σ(stoich[i]·rᵢ·V) + Fᵢ_feed
dV/dt  = Q_in = FB0/CB_feed
```
State: `[NA, NB, NR, NS, V]`, 200 RK4 steps.

**`catalyticPFR`**

Wrapper around `pfrModel` that converts catalyst weight `W_cat` to equivalent reactor
volume: `V_bed = W_cat / (ρ_bulk · (1−ε_bed))`.

### 6.5 Numerics (`numerics.ts`)

Two pure utilities:

**`bisect(f, lo, hi, maxIter=60)`**
Standard bisection root-finding. If the bracket is invalid (signs don't straddle zero),
returns the endpoint with smaller |f|. Used by isothermalCstrSingle and nonIsothermalCstr.

**`rk4Step(fn, t, y, h)`**
Classic 4th-order Runge-Kutta step. Returns a new array (no mutation).
Used by pfrModel, dynamicEngine, semibatchModel, and gasPhaseFactor.

### 6.6 Network Solver & Recycle Algorithm (`networkSolver.ts`)

**Algorithm**: successive substitution (direct iteration) with 50% damping.

```
tear_streams_0 = {Xa=0, Ca=Ca0, Cr=0, Cs=0, flow=1, T=T_feed}

for iter in 1..200:
    computed = forwardPass(nodes, edges, tear_streams, params, chemistry)
    
    error = max over tear edges of:
              |ΔXa|, |ΔCa|, |ΔT/300|
    
    if error < 1e-6: converged ✓
    
    new_guess = 0.5·old_guess + 0.5·computed   (50% damping)
```

The recycle loop terminates and reports `converged=false` after 200 iterations. The UI
shows the iteration history in the RecyclePanel.

Stream mixing (at Mixer nodes) is done by flow-weighted average:
```
Ca_mix = Σ(Cᵢ·flowᵢ) / Σ(flowᵢ)
T_mix  = Σ(Tᵢ·flowᵢ) / Σ(flowᵢ)
```

The Splitter node splits the total stream by fraction `α`:
- Top outlet: α × inlet flow
- Bottom outlet: (1−α) × inlet flow (→ recycle in typical setups)

### 6.7 Topology (`topology.ts`)

**`findTearEdgeIds(nodes, edges)`**: DFS on the directed graph; back-edges (edges into a
gray node) become tear edges. This correctly identifies the minimal set of streams that,
when cut, turn the cyclic graph into a DAG.

**`topoSort(nodes, edges, tearIds)`**: Kahn's algorithm on the DAG (tear edges excluded).
Returns a complete ordering iff the DAG has no remaining cycles.

**`reachableFrom(startId, edges)`** and **`reachableTo(endId, edges)`**: BFS utilities used
to determine which reactor nodes lie on a valid feed→product path.

### 6.8 Levenspiel Curve & RTD

**`buildLevenspielCurve(params)`** (`kinetics.ts`): Computes 200 points of
Fₐ₀/(−rₐ) vs Xₐ. For parallel reactions, uses the effective total rate constant k₁+k₂.

**`computeRTD(tau, N, Da, nPts)`** (`rtdModel.ts`): Returns E(t) curves for:
- CSTR: E(t) = (1/τ)·exp(−t/τ)
- Tanks-in-series (N tanks): E(t) = N·(Nt/τ)^(N−1)·exp(−Nt/τ) / [τ·(N−1)!]
- PFR: approximated as a narrow Gaussian at t = τ

Also returns conversions Xₐ_CSTR, Xₐ_PFR, Xₐ_TIS for 1st-order reaction at given Da.

### 6.9 Operating Diagram (`operatingDiagramModel.ts`)

For **cooled** CSTRs in single-reaction mode. Generates:
- **G(T)**: heat generation = (−ΔH)·Cₐ₀·(Xₐ(T)−Xₐ_in) where Xₐ(T) is from CSTR design eq.
- **R(T)**: heat removal = ρCp·(T−T_in) + κ_v·τ·(T−Tc)

Steady states found where G(T) = R(T) by scanning sign changes.
Stability: dG/dT < dR/dT (slope condition) → stable.

### 6.10 Gas-Phase Factor & Pressure Drop

**`gasPhaseFactor.ts`** — ε-factor (Fogler convention):
```
ε = (total moles at Xₐ=1 − total moles at Xₐ=0) / total moles at Xₐ=0
```
Pure A feed, A→2R: ε = (2−1)/1 = 1
Pure A feed, 2A→R: ε = (1−2)/2 = −0.5

**`pressureDropModel.ts`** — Ergun equation for fixed beds:
```
dP/dτ = −β₀·u₀
β₀ = G(1−φ)/(ρ·Dp·φ³) · [150(1−φ)μ/Dp + 1.75G]
```
Uses liquid-phase defaults: μ = 8.9×10⁻⁴ Pa·s, ρ = 1000 kg/m³.

### 6.11 Sweep, Target, Comparison Engines

**`sweepEngine.ts`**: Runs `solveNetwork()` at N evenly spaced values of k, Ca0, T_feed,
or τ (on a specific node). Returns {paramValue, Xa, yieldR, converged}[].

**`targetSolver.ts`**: Binary-search-driven inverse: find the τ (or k) that achieves a
user-specified target conversion Xₐ.

**`comparisonEngine.ts`**: Runs the same chemistry on a CSTR and PFR side-by-side at
identical τ values to produce a performance comparison chart.

### 6.12 Dynamic Engine (`dynamicEngine.ts`)

Integrates the CSTR ODE in real time for transient simulation:
```
dC/dt = (C_in − C) / τ + net_production(C, T)     (per species)
dT/dt = [(−ΔH)·r − κ_v·(T−Tc)] / ρCp + (T_in−T)/τ
```
State initialised to steady-state values, then a disturbance multiplier scales the feed
concentration. Topology is re-solved at each time step using the same tear-edge algorithm.

---

## 7. Supported Reaction Modes

| Mode | Reactions | Species |
|------|-----------|---------|
| `single` + `first-order` | A → R, r = k·Cₐ | A, R |
| `single` + `second-order` | A → R, r = k·Cₐ² | A, R |
| `single` + `autocatalytic` | A → R, r = k·Cₐ·(Cᵣ+Cr0·Cₐ₀) | A, R |
| `single` + `reversible` | A ⇌ R, r = k·(Cₐ−Cᵣ/Keq) | A, R |
| `single` + `gas-phase-1st-order` | A → R (gas), r includes 1/(1+ε·Xₐ) | A, R |
| `series` | A→R (k₁), R→S (k₂) | A, R, S |
| `series3` | A→R (k₁), R→S (k₂), S→T (k₃) | A, R, S, T |
| `parallel` | A→R (k₁), A→S (k₂) | A, R, S |
| `series-parallel` | A+B→R (k₁), R+B→S (k₂), S+B→T (k₃) | A, B, R, S, T |
| `denbigh` | A→R (k₁), A→T (k₂), R→S (k₃), R→U (k₄) | A, R, S, T, U |
| `custom` | User-defined power-law / MM / LH | User-defined |

Custom rate types:
- **Power-law**: r = k·∏Cᵢⁿⁱ (with optional reversible term −k/Keq·∏Cⱼ^stoich)
- **Michaelis-Menten**: r = Vmax·Cₐ / (Km + Cₐ)
- **Langmuir-Hinshelwood**: r = k·Cₐ / (1 + K_A·Cₐ + K_B·Cᵦ)

---

## 8. Supported Reactor Types & Thermal Modes

| Reactor | Symbol | Model used |
|---------|--------|-----------|
| CSTR | Perfectly mixed, steady-state | Bisection / fixed-point iteration |
| PFR | Plug flow | 200-step RK4 ODE |
| Batch | Closed, perfectly mixed | Same as PFR (time = space time) |
| Semibatch | Continuous B feed, variable volume | RK4 on moles+volume |
| Fixed Bed | Packed bed, catalytic | pfrModel + Ergun optional |
| Mixer | Ideal mixing of streams | Flow-weighted average |
| Splitter | Split by fraction α | Two output streams |

| Thermal mode | Equation |
|---|---|
| Isothermal | T = constant |
| Adiabatic | dT/dτ = (−ΔH)·rₐ / ρCp |
| Cooled (jacketed) | dT/dτ = [(−ΔH)·rₐ − κ_v·(T−Tc)] / ρCp |

---

## 9. State Management (Zustand)

```
SimulatorStore (single Zustand store)
├── topologySlice   { nodes, edges, setNodes, setEdges, addReactor, … }
├── paramsSlice     { params: SimulationParams, updateParams() }
├── resultSlice     { result: SimulationResult | null, setResult() }
├── sessionSlice    { sessionId, scenarios[], saveScenario(), loadScenario() }
├── toastSlice      { toasts[], addToast(), dismissToast() }
├── sweepSlice      { sweepConfig, sweepResult, runSweep() }
└── plotConfigSlice { plotAxes, xAxis, yAxis, toggleSpecies() }
```

**Rule**: No new fields should be added to any slice without updating:
1. `serializer.ts` migration map
2. `sweepEngine.ts` / `targetSolver.ts` / `comparisonEngine.ts` spread operators
3. `purity.test.ts` round-trip test

---

## 10. UI Components

The canvas uses `@xyflow/react` (ReactFlow) as the interaction layer. Each reactor type
maps to a custom node component in `src/components/canvas/`. Node data (`ReactorNodeData`)
is stored in ReactFlow's node.data field and synced to the Zustand store via `useReactorNode`.

Plot panels are pure Recharts components that read from `resultSlice` and re-render
whenever the result changes. They do not trigger simulations themselves.

The `ParameterPanel` is the main global parameter editor. Individual reactor nodes have
a `ParameterPopover` for per-node settings (τ, thermal mode, Tc, κ_v, pressure drop).

---

## 11. I/O Layer

**`serializer.ts`**: Converts the entire application state (nodes, edges, params) to a JSON
object (`SavedState`) and back. Includes a version migration map for forward compatibility.
**Zero React/Zustand imports** — fully portable TypeScript.

**`examples.ts`**: Array of `Example` objects, each containing a complete `SavedState`.
Loaded by the UI as "quick-start" templates.

File export/import is handled by `useFileIO.ts` using browser `Blob` + `<a download>`.

---

## 12. Architectural Invariants

These rules must be maintained to keep the codebase coherent:

1. **Single branching point**: `getPreset(params)` in `reactionRegistry.ts` is the only
   function that switches on `reactionMode` or `kinetics`. No other file may contain
   `params.kinetics ===` or `params.reactionMode ===`.

2. **ChemistryModel injection**: Rate laws enter the solver as `chemistry.reactions[i].rateLaw(C, T, kParams)`.
   No kinetics-specific logic lives in `networkSolver.ts`, `unitModels.ts`, or `dynamicEngine.ts`.

3. **Pure math layer**: Every file in `src/math/` has zero imports from React, Zustand, or
   `@xyflow/react`. This ensures testability and portability.

4. **Pure I/O**: `serializer.ts` imports nothing from React, Zustand, or `@xyflow/react`.

5. **Stream bridge ownership**: Conversions between `Stream` (molar flows) and `StreamState`
   (concentrations) happen only in `streamBridge.ts`.

6. **Topology ownership**: `findTearEdgeIds` and `topoSort` live only in `topology.ts` and
   are imported by both `networkSolver.ts` and `dynamicEngine.ts`.

7. **Numerics isolation**: `numerics.ts` has zero imports — pure functions only.

---

## 13. 10 Verification Test Cases

These test cases are ordered from easy to hard. For each, you'll find:
- The **simulator configuration** (what to enter in the UI)
- The **hand-calculation** using the governing equations
- The **expected answer** that the simulator should produce
- The **concept** being tested

All concentrations in **mol/L**, time in **s**, temperature in **K**, energy in **kJ/mol**.

---

### Test 1 — Isothermal CSTR, 1st Order (Easy)

**Configuration**
- Topology: Feed → CSTR → Product
- Reaction mode: Single | 1st Order
- k = 0.5 s⁻¹, Ca0 = 1.0 mol/L, τ = 2.0 s
- Thermal mode: Isothermal, Ea = 0

**Governing equations**

Design equation for a CSTR:
```
τ = (Ca0 − Ca) / (−rA)    with  rA = k·Ca
```
Define Damköhler number: **Da = k·τ**

Solving for Ca:
```
Ca = Ca0 / (1 + Da)
Xa = Da / (1 + Da)
```

**Hand calculation**
```
Da   = 0.5 × 2.0 = 1.0
Xa   = 1.0 / (1 + 1.0) = 0.500
Ca   = 1.0 / 2.0       = 0.500 mol/L
Cr   = Ca0 − Ca        = 0.500 mol/L
```

**Expected simulator output**
- Xa = **0.500**
- Ca_out = **0.500 mol/L**

**Concept tested**: Fundamental CSTR design equation, Da = kτ.

---

### Test 2 — Isothermal PFR, 1st Order (Easy)

**Configuration**
- Topology: Feed → PFR → Product
- Same parameters as Test 1 (k=0.5, Ca0=1, τ=2, isothermal)

**Governing equations**

PFR design equation (integrated for 1st order):
```
−dCa/dτ = k·Ca    →    Ca = Ca0·exp(−k·τ)
Xa = 1 − exp(−Da)
```

**Hand calculation**
```
Da = 1.0
Xa = 1 − exp(−1.0) = 1 − 0.3679 = 0.6321
Ca = 1.0 × exp(−1.0) = 0.368 mol/L
```

**Expected simulator output**
- Xa = **0.632**
- Ca_out = **0.368 mol/L**

**Key insight**: At Da = 1.0, PFR (0.632) > CSTR (0.500). A PFR always outperforms a
CSTR for positive-order reactions at the same space time. The ratio diverges at high Da.

---

### Test 3 — Isothermal CSTR, 2nd Order (Easy–Medium)

**Configuration**
- Single | 2nd Order (power-law in custom, or second-order kinetics preset)
- k = 0.5 L·mol⁻¹·s⁻¹, Ca0 = 1.0 mol/L, τ = 2.0 s, isothermal

**Governing equations**

CSTR with r = k·Ca²:
```
τ = (Ca0 − Ca) / (k·Ca²)
k·τ·Ca² + Ca − Ca0 = 0
```
Quadratic in Ca:
```
Ca = [−1 + √(1 + 4·k·τ·Ca0)] / (2·k·τ)
```
Equivalent using Da₂ = k·Ca0·τ:
```
Ca = Ca0·[−1 + √(1 + 4·Da₂)] / (2·Da₂)
Xa = 1 − Ca/Ca0
```

**Hand calculation**
```
Da₂ = 0.5 × 1.0 × 2.0 = 1.0
Ca  = [−1 + √(1 + 4)] / 2 = [−1 + √5] / 2 = [−1 + 2.236] / 2 = 0.618 mol/L
Xa  = 1 − 0.618 = 0.382
```

**Expected simulator output**
- Xa = **0.382**
- Ca_out = **0.618 mol/L**

**Key insight**: At the same Da₂=1, CSTR 2nd-order (Xa=0.382) gives lower conversion than
CSTR 1st-order (Xa=0.500) because the rate falls off faster with conversion.

---

### Test 4 — Two CSTRs in Series, 1st Order (Medium)

**Configuration**
- Topology: Feed → CSTR-1 → CSTR-2 → Product
- k = 0.5 s⁻¹, Ca0 = 1.0 mol/L, τ₁ = τ₂ = 1.0 s each
- Both isothermal

**Governing equations**

For N equal CSTRs in series (each with τ_i = τ_total/N):
```
Xa = 1 − 1/(1 + Da/N)^N
```
where Da = k·τ_total, N = number of tanks.

Step-by-step:
```
Stage 1:  Xa₁ = Da₁/(1+Da₁)     Da₁ = k·τ₁
Stage 2:  Ca₂ = Ca₁/(1+k·τ₂)    where Ca₁ = Ca0·(1−Xa₁)
          Xa₂ = 1 − Ca₂/Ca0
```

**Hand calculation**
```
Total τ = 2.0 s, Da_total = 0.5 × 2.0 = 1.0, N = 2

Using the formula:
Xa = 1 − 1/(1 + 1.0/2)² = 1 − 1/(1.5)² = 1 − 1/2.25 = 0.556

Step-by-step verification:
Da₁ = 0.5 × 1.0 = 0.5
Xa₁ = 0.5/1.5 = 0.333      Ca₁ = 0.667 mol/L
Ca₂ = 0.667/1.5 = 0.444    Xa₂ = 1−0.444 = 0.556  ✓
```

**Expected simulator output**
- Overall Xa = **0.556**
- Ca after CSTR-1 = **0.667 mol/L**
- Ca after CSTR-2 = **0.444 mol/L**

**Key insight**: 2 CSTRs in series (Xa=0.556) > 1 CSTR of same total τ (Xa=0.500).
As N→∞ the series of CSTRs approaches a PFR (Xa=0.632). This is the RTD principle.

---

### Test 5 — Parallel Reactions A→R / A→S, Selectivity (Medium)

**Configuration**
- Reaction mode: Parallel (A→R desired, A→S waste)
- k₁ = 0.5 s⁻¹ (to R), k₂ = 0.3 s⁻¹ (to S)
- Ca0 = 1.0 mol/L, τ = 1.0 s, isothermal CSTR

**Governing equations**

Both reactions consume A, so the effective rate of A disappearance is:
```
−rA = (k₁ + k₂)·Ca
```
Point selectivity (dCr/d(−Ca) at any Ca):
```
S_R = k₁/(k₁ + k₂)     (constant, independent of Ca)
```
Because S_R is constant, the overall yield equals:
```
Y_R = Cr/Ca0 = S_R · Xa
```
This is the same in both CSTR and PFR at the same conversion.

For a CSTR:
```
Da_eff = (k₁+k₂)·τ = 0.8×1 = 0.8
Xa  = 0.8/1.8 = 0.444
S_R = 0.5/0.8 = 0.625
Y_R = 0.625 × 0.444 = 0.278
Cr  = Y_R × Ca0 = 0.278 mol/L
Cs  = Ca0·Xa − Cr = 0.444 − 0.278 = 0.166 mol/L
```

**Expected simulator output**
- Xa = **0.444**
- Cr = **0.278 mol/L**
- Cs = **0.167 mol/L**
- Selectivity S_R = **0.625** (should be same in CSTR and PFR at same Xa)

**Key insight**: For 1st-order parallel reactions with the **same** order, selectivity is
fixed at k₁/(k₁+k₂) and does not depend on reactor type, conversion, or concentration.
Changing reactor type only changes the *yield* (by changing Xa), not the selectivity.

---

### Test 6 — Series A→R→S in a CSTR, Optimal Space Time (Medium)

**Configuration**
- Reaction mode: Series (A→R→S)
- k₁ = 0.5 s⁻¹ (A→R desired), k₂ = 0.1 s⁻¹ (R→S waste)
- Ca0 = 1.0 mol/L, vary τ to find maximum Cr

**Governing equations**

CSTR balances:
```
A balance: Ca = Ca0/(1 + k₁·τ)
R balance: Cr = k₁·τ·Ca / (1 + k₂·τ) = k₁·τ·Ca0 / [(1+k₁τ)(1+k₂τ)]
```
Maximise Cr with respect to τ:
```
d(Cr)/dτ = 0  →  1 − k₁k₂τ² = 0  →  τ_opt = 1/√(k₁k₂)
```
Maximum yield of R:
```
τ_opt = 1/√(0.5 × 0.1) = 1/√0.05 = 4.47 s
Da₁_opt = k₁·τ_opt = 0.5 × 4.47 = 2.236
Da₂_opt = k₂·τ_opt = 0.1 × 4.47 = 0.447

Ca_opt  = 1.0/(1 + 2.236)    = 0.309 mol/L
Cr_opt  = 2.236 × 1.0 / (3.236 × 1.447)  = 2.236/4.682  = 0.478 mol/L
Xa_opt  = 1 − 0.309          = 0.691
```

**Expected simulator output** (at τ = 4.47 s)
- Xa = **0.691**
- Cr = **0.478 mol/L** (maximum)
- If τ < 4.47: Cr is lower (not enough A converted)
- If τ > 4.47: Cr is lower (R being converted to S)

The Selectivity Panel should show Da_opt ≈ 2.24 (= √(k₁/k₂)).

**Concept tested**: Intermediate product optimisation, τ_opt = 1/√(k₁k₂), a key result
from Chapters 6–7 of Levenspiel or Fogler.

---

### Test 7 — Adiabatic CSTR, 1st Order with Temperature-Dependent k (Medium–Hard)

**Configuration**
- Reaction mode: Single | 1st Order
- k = 0.5 s⁻¹ (at T_ref = 300 K), Ea = 50 kJ/mol
- Ca0 = 1.0 mol/L, τ = 2.0 s
- Thermal mode: **Adiabatic**, ΔH = −50 kJ/mol, ρCp = 4.18 kJ/(L·K)

**Governing equations**

Energy balance (adiabatic CSTR):
```
T = T_feed + (−ΔH)·Ca0·Xa / ρCp = 300 + 50×1×Xa/4.18 = 300 + 11.96·Xa
```
CSTR design equation (with temperature-dependent k):
```
Xa/(1−Xa) = k(T)·τ

k(T) = 0.5·exp[(50/0.008314)·(1/300 − 1/T)]
```
Substituting T = 300 + 11.96·Xa into the design equation gives a single transcendental
equation in Xa. Solved numerically by the simulator (bisection on T):

**Iterative solution (manual)**

Guess Xa = 0.5:
```
T  = 300 + 11.96×0.5 = 305.98 K
k  = 0.5·exp[6012·(1/300−1/305.98)]
   = 0.5·exp[6012·0.0000651] = 0.5·exp(0.391) = 0.5×1.479 = 0.740
RHS = k·τ/(1+k·τ) = 0.740×2/(1+1.48) = 0.597  ≠ 0.5 (not converged)
```
Guess Xa = 0.55:
```
T  = 300 + 11.96×0.55 = 306.58 K
k  = 0.5·exp[6012·(1/300−1/306.58)] = 0.5·exp(0.430) = 0.5×1.537 = 0.769
RHS = 0.769×2/(1+1.538) = 0.606  ≠ 0.55
```
Continue until Xa ≈ 0.612 (simulator should converge to this in a few bisection steps).

**Expected simulator output** (approximate)
- Xa ≈ **0.61–0.63** (higher than the isothermal 0.500 due to exothermic temperature rise)
- T_out ≈ **307–308 K**

Compare with isothermal result (Test 1): Xa_isothermal = 0.500 < Xa_adiabatic because the
temperature rise accelerates the rate (exothermic + positive Ea).

**Concept tested**: Simultaneous material and energy balance, adiabatic temperature rise
κ = (−ΔH)·Ca0/ρCp, feedback between conversion and temperature.

---

### Test 8 — Gas-Phase PFR, A→2R, ε = 1 (Hard)

**Configuration**
- Reaction mode: Single | Gas-Phase 1st Order
- k = 0.5 s⁻¹, Ca0 = 1.0 mol/L, τ = 2.0 s
- ε = 1.0 (pure A feed, A→2R, so ε = (2−1)/1 = 1)
- Thermal mode: Isothermal

**Governing equations**

For gas-phase first-order A → 2R with ε = 1:
```
Ca = Ca0·(1−Xa)/(1+ε·Xa) = Ca0·(1−Xa)/(1+Xa)

PFR: dXa/dτ = k·(1−Xa)/(1+Xa)
```
Separating variables and integrating:
```
∫₀^Xa (1+Xa)/(1−Xa) dXa = k·τ

Write: (1+x)/(1−x) = 2/(1−x) − 1

∫₀^Xa [2/(1−x) − 1] dx = [−2·ln(1−x) − x]₀^Xa = k·τ
```
Final equation:
```
−2·ln(1−Xa) − Xa = k·τ
```

**Hand calculation**
```
k·τ = 0.5 × 2.0 = 1.0
Solve: f(Xa) = −2·ln(1−Xa) − Xa − 1.0 = 0

f(0.50) = −2·ln(0.50) − 0.50 − 1.0 = 1.386 − 1.50 = −0.114
f(0.55) = −2·ln(0.45) − 0.55 − 1.0 = 1.598 − 1.55 = +0.048

Linear interpolation:
Xa ≈ 0.50 + 0.05 × 0.114/(0.114+0.048) = 0.50 + 0.05×0.704 = 0.535
```

**Expected simulator output**
- Xa ≈ **0.535**
- Compare with ε = 0 (liquid-phase): Xa = 1−exp(−1.0) = **0.632**

Gas-phase expansion (ε > 0) reduces conversion because the growing volume dilutes A,
lowering the concentration and hence the rate.

**Concept tested**: Volumetric expansion in gas-phase reactions, modified PFR design
equation, the Fogler ε-factor. Common exam problem in reaction engineering courses.

---

### Test 9 — Reversible Reaction A⇌R in a CSTR (Hard)

**Configuration**
- Reaction mode: Single | Reversible (A⇌R)
- k_fwd = 0.5 s⁻¹ (at T_ref = 300 K), Keq_ref = 4.0, Ea = 0
- Ca0 = 1.0 mol/L, vary τ from 0 to 20 s
- Thermal mode: Isothermal

**Governing equations**

Rate law for reversible liquid-phase reaction:
```
r = k·(Ca − Cr/Keq)
```
Equilibrium conversion (thermodynamic limit):
```
Xa_eq = Keq/(1 + Keq) = 4.0/5.0 = 0.800
```
CSTR design equation:
```
(Ca0 − Ca)/τ = k·(Ca − Cr/Keq)
```
Using Ca = Ca0·(1−Xa) and Cr = Ca0·Xa (liquid phase, equimolar):
```
Ca0·Xa/τ = k·Ca0·[(1−Xa) − Xa/Keq] = k·Ca0·[1 − Xa·(1+1/Keq)]

Xa = k·τ / (1 + k·τ·(1+1/Keq))
   = Da / (1 + Da·(Keq+1)/Keq)
```
where Da = k·τ.

For a PFR:
```
dXa/dτ = k·[1 − Xa·(1+1/Keq)] / Ca0... wait this should be:
−dCa/dτ = k·(Ca − Cr/Keq) = k·Ca0·[(1−Xa) − Xa/Keq]

Xa_PFR = Xa_eq·(1 − exp(−k·(1+1/Keq)·τ))
       = Xa_eq·(1 − exp(−Da·(Keq+1)/Keq))
```

**Hand calculation**

Keq = 4.0, Xa_eq = 0.800. Define effective Da_rev = Da·(Keq+1)/Keq = Da × 5/4 = 1.25·Da

At τ = 2.0 s, Da = 1.0:

CSTR:
```
Xa = 1.0 / (1 + 1.0×5/4) = 1.0/(1+1.25) = 1.0/2.25 = 0.444
```

PFR:
```
Xa = 0.800 × (1 − exp(−1.25)) = 0.800 × (1 − 0.287) = 0.800 × 0.713 = 0.571
```

At very large τ, both converge to:
```
Xa → Xa_eq = 0.800
```

**Expected simulator output** (τ = 2.0 s)
- CSTR: Xa = **0.444**
- PFR: Xa = **0.571**
- Equilibrium limit displayed: Xa_eq = **0.800**

**Concept tested**: Thermodynamic limit on conversion, modified Da for reversible reactions,
difference between equilibrium conversion (Keq-limited) and kinetically-limited conversion.

---

### Test 10 — PFR with Recycle Loop (Hard)

**Configuration**
- Topology: Feed → Mixer → PFR (τ_rxr = 1.0 s) → Splitter (α = 1/3) → Product
  └───────────────────────────────────────────────────────────────────────┘ (recycle)
- Reaction mode: Single | 1st Order
- k = 0.5 s⁻¹, Ca0 = 1.0 mol/L, Ea = 0, isothermal
- Splitter: α = 1/3 to product, (1−α) = 2/3 to recycle → **recycle ratio R = 2**

**Governing equations**

Define:
- v₀ = fresh feed flow = 1 (normalised)
- R = (1−α)/α = 2 (recycle flow / fresh feed flow, assuming steady state at same volumetric flow)
- Flow through PFR = (1+R)·v₀ = 3·v₀
- PFR residence time = V/(3v₀) = τ_rxr (set by the node)
- Overall space time τ_total = V/v₀ = (1+R)·τ_rxr = 3.0 s

**Mixer mass balance:**
```
Ca_mix = (Ca0 + R·Ca_out) / (1+R) = (1 + 2·Ca_out) / 3
```
**PFR design equation** (inlet = mixer, outlet = splitter):
```
Ca_out = Ca_mix · exp(−k·τ_rxr)
```
Substituting:
```
Ca_out = [(1 + 2·Ca_out)/3] · exp(−0.5×1.0)
3·Ca_out = (1 + 2·Ca_out) · exp(−0.5)
3·Ca_out = (1 + 2·Ca_out) · 0.6065
3·Ca_out = 0.6065 + 1.213·Ca_out
(3 − 1.213)·Ca_out = 0.6065
Ca_out = 0.6065 / 1.787 = 0.339 mol/L
Xa_out = 1 − 0.339 = 0.661
```

**Verification — alternate approach:**
Solve analytically: `Ca_out = Ca0 / (3·exp(k·τ_rxr) − 2)`
```
Ca_out = 1 / (3·exp(0.5) − 2) = 1 / (3×1.6487 − 2) = 1 / (4.946−2) = 1/2.946 = 0.340 mol/L ✓
```

**Comparison (no recycle, same τ_total = 3 s):**
```
Xa = 1 − exp(−k·τ_total) = 1 − exp(−1.5) = 0.777
```

**Expected simulator output**
- Xa_out (with recycle R=2) = **0.661**
- Without recycle (τ=3): Xa = 0.777

**Key insight**: Recycle *hurts* PFR performance for positive-order reactions by diluting
the feed (recycling unconverted A back). The PFR "sees" a less favourable inlet concentration.
Recycle is beneficial in other contexts: for autocatalytic reactions (the product seeds the
reaction), or to allow an exothermic reactor to operate at a controlled temperature.

The simulator's recycle convergence should reach this answer within ~5–10 iterations.
Check the RecyclePanel to see the convergence history. If it diverges, reduce damping or
check the splitter α setting.

---

### Summary Table

| # | Reactor | Reaction | Mode | Expected Xa | Key formula |
|---|---------|----------|------|------------|-------------|
| 1 | CSTR | 1st order | Isothermal | 0.500 | Xa = Da/(1+Da) |
| 2 | PFR | 1st order | Isothermal | 0.632 | Xa = 1−exp(−Da) |
| 3 | CSTR | 2nd order | Isothermal | 0.382 | Xa from quadratic |
| 4 | 2×CSTR series | 1st order | Isothermal | 0.556 | Xa = 1−1/(1+Da/N)^N |
| 5 | CSTR | Parallel A→R/S | Isothermal | Xa=0.444, S_R=0.625 | S_R = k₁/(k₁+k₂) |
| 6 | CSTR | Series A→R→S | Isothermal | Cr_max=0.478 at τ=4.47s | τ_opt = 1/√(k₁k₂) |
| 7 | CSTR | 1st order | Adiabatic | Xa ≈ 0.62 | T = T₀+κ·Xa, transcendental |
| 8 | PFR | Gas-phase A→2R | Isothermal | Xa ≈ 0.535 | −2ln(1−Xa)−Xa = kτ |
| 9 | CSTR+PFR | Reversible A⇌R | Isothermal | 0.444/0.571 | Xa_eq = Keq/(1+Keq) |
| 10 | PFR+recycle | 1st order | Isothermal | 0.661 | Ca_out = Ca0/(3e^(kτ)−2) |

---

*Document generated 2026-06-11 from source code at commit `bc00b38` (branch `main`).*
