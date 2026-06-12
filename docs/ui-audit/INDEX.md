# UI Audit — Reaction Simulator
Captured 2026-06-13 at 1440×900 (light mode unless noted). Used for design direction review.

## Canvas & global chrome
| # | File | Surface |
|---|------|---------|
| 01 | [01-canvas-default.png](01-canvas-default.png) | Full app — default flowsheet (CSTR → PFR), guided tour visible |
| 02 | [02-dark-mode.png](02-dark-mode.png) | Dark mode toggle |
| 23 | [23-viewport-1280.png](23-viewport-1280.png) | 1280×800 viewport |
| 24 | [24-viewport-1920.png](24-viewport-1920.png) | 1920×1080 viewport |

## Left toolbar — category flyouts
| # | File | Surface |
|---|------|---------|
| 03 | [03-toolbar-reactors.png](03-toolbar-reactors.png) | Reactors flyout (CSTR, PFR, Batch, SB, FB) |
| 04 | [04-toolbar-separate.png](04-toolbar-separate.png) | Separate flyout (Flash, Purge, CSplit, HX) |
| 05 | [05-toolbar-pressure.png](05-toolbar-pressure.png) | Pressure flyout (Pump, Comp, Valve) |
| 06 | [06-toolbar-flow.png](06-toolbar-flow.png) | Flow flyout (Mixer, Splitter, Feed, Product) |

## Left toolbar — bottom actions
| # | File | Surface |
|---|------|---------|
| 07 | [07-params-panel.png](07-params-panel.png) | Global Params panel open |
| 08 | [08-examples-flyout.png](08-examples-flyout.png) | Examples flyout |
| 09 | [09-export-flyout.png](09-export-flyout.png) | Export flyout (PNG / CSV / Report) |

## Right panel — plot tabs
| # | File | Surface |
|---|------|---------|
| 10 | [10-panel-levenspiel.png](10-panel-levenspiel.png) | Levenspiel plot |
| 11 | [11-panel-profiles.png](11-panel-profiles.png) | Concentration / temperature profiles |
| 12 | [12-panel-thermal.png](12-panel-thermal.png) | Thermal analysis |
| 13 | [13-panel-dynamic.png](13-panel-dynamic.png) | Dynamic simulation |
| 14 | [14-panel-analysis.png](14-panel-analysis.png) | Parameter sensitivity / analysis |
| 15 | [15-panel-scenarios.png](15-panel-scenarios.png) | Scenario comparison |
| 16 | [16-panel-design.png](16-panel-design.png) | Design specs panel |

## Node interactions
| # | File | Surface |
|---|------|---------|
| 17 | [17-node-cstr-selected.png](17-node-cstr-selected.png) | CSTR node selected |
| 18 | [18-node-cstr-edit.png](18-node-cstr-edit.png) | CSTR node — double-click (inline param edit) |
| 19 | [19-node-pfr-selected.png](19-node-pfr-selected.png) | PFR node selected |
| 21 | [21-context-menu.png](21-context-menu.png) | Node right-click context menu |

## Data tables
| # | File | Surface |
|---|------|---------|
| 22 | [22-stream-table.png](22-stream-table.png) | Stream table (right panel, below plots) |

## To capture manually (not automatable headlessly)
- **20** — Reaction builder modal (opens from node panel; requires click sequence on live UI)
- Feed / Product / Flash / HX node selected states
- Design spec solver in-progress state
