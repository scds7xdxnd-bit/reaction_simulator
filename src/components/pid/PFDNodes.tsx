/**
 * F21 — PFD mode node components.
 * Each component replicates the exact Handle IDs & positions of its schematic
 * counterpart so edges stay connected when the view mode toggles.
 * Visual content swaps to ISO 10628-flavoured SVG symbols via PFDSymbols.tsx.
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { PFDSymbol } from './PFDSymbols';

// ─── Common types ─────────────────────────────────────────────────────────────

interface BasePFDData {
  label?: string;
  _pfdTag?: string;
  thermalMode?: string;
  [key: string]: unknown;
}

interface PFDNodeProps {
  id: string;
  selected?: boolean;
  data: BasePFDData;
}

// ─── Shell component — shared layout for all PFD nodes ────────────────────────

interface ShellProps {
  w: number;
  h: number;
  color: string;
  selected?: boolean;
  tag?: string;
  label?: string;
  children: React.ReactNode;
}

function Shell({ w, h, color, selected, tag, label, children }: ShellProps) {
  return (
    <div
      style={{
        width: w, height: h, position: 'relative', color,
        outline: selected ? `2px solid ${color}` : undefined,
        outlineOffset: 2,
      }}
    >
      {children}

      {tag && (
        <span style={{
          position: 'absolute', top: 3, left: 3, zIndex: 10,
          fontSize: 7, fontWeight: 700, fontFamily: 'monospace',
          background: color, color: 'white',
          padding: '1px 5px', borderRadius: 3, letterSpacing: 0.5,
          pointerEvents: 'none',
        }}>
          {tag}
        </span>
      )}
      {label && (
        <span style={{
          position: 'absolute', bottom: 2, left: 0, right: 0,
          textAlign: 'center', fontSize: 9, fontWeight: 500,
          color: '#374151', pointerEvents: 'none',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

// ─── Handle style helpers ─────────────────────────────────────────────────────

const hs = (color: string) => ({ width: 8, height: 8, background: color, border: 'none' });

// ─── Equipment nodes — 1 in (Left), 1 out (Right) ────────────────────────────

const REACTOR_COLOR = '#2563eb';

function PFDCSTRNode({ id, data, selected }: PFDNodeProps) {
  const instruments = data.thermalMode && data.thermalMode !== 'isothermal' ? ['TC'] : [];
  return (
    <Shell w={96} h={90} color={REACTOR_COLOR} selected={selected}
      tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs(REACTOR_COLOR), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs(REACTOR_COLOR), right: -4 }} />
      <PFDSymbol type="cstr" instruments={instruments} />
    </Shell>
  );
}

function PFDPFRNode({ id, data, selected }: PFDNodeProps) {
  const instruments = data.thermalMode && data.thermalMode !== 'isothermal' ? ['TC'] : [];
  return (
    <Shell w={110} h={75} color="#d97706" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#d97706'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#d97706'), right: -4 }} />
      <PFDSymbol type="pfr" instruments={instruments} />
    </Shell>
  );
}

function PFDFixedBedNode({ id, data, selected }: PFDNodeProps) {
  return (
    <Shell w={88} h={100} color="#7c3aed" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#7c3aed'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#7c3aed'), right: -4 }} />
      <PFDSymbol type="fixedbed" />
    </Shell>
  );
}

function PFDBatchNode({ id, data, selected }: PFDNodeProps) {
  return (
    <Shell w={88} h={90} color="#be123c" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#be123c'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#be123c'), right: -4 }} />
      <PFDSymbol type="batch" />
    </Shell>
  );
}

function PFDSemibatchNode({ id, data, selected }: PFDNodeProps) {
  return (
    <Shell w={88} h={90} color="#9f1239" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#9f1239'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#9f1239'), right: -4 }} />
      <PFDSymbol type="semibatch" />
    </Shell>
  );
}

function PFDHXNode({ id, data, selected }: PFDNodeProps) {
  return (
    <Shell w={88} h={88} color="#dc2626" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#dc2626'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#dc2626'), right: -4 }} />
      <PFDSymbol type="hx" instruments={['TI']} />
    </Shell>
  );
}

function PFDPumpNode({ id, data, selected }: PFDNodeProps) {
  return (
    <Shell w={80} h={80} color="#1d4ed8" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#1d4ed8'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#1d4ed8'), right: -4 }} />
      <PFDSymbol type="pump" instruments={['FI']} />
    </Shell>
  );
}

function PFDCompNode({ id, data, selected }: PFDNodeProps) {
  return (
    <Shell w={88} h={75} color="#7c3aed" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#7c3aed'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#7c3aed'), right: -4 }} />
      <PFDSymbol type="comp" instruments={['FI']} />
    </Shell>
  );
}

function PFDValveNode({ id, data, selected }: PFDNodeProps) {
  return (
    <Shell w={88} h={75} color="#b45309" selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in" style={{ ...hs('#b45309'), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out" style={{ ...hs('#b45309'), right: -4 }} />
      <PFDSymbol type="valve" />
    </Shell>
  );
}

// ─── Flash — 1 in (Left), 2 out Right (vapor top 28%, liquid bottom 72%) ─────

function PFDFlashNode({ id, data, selected }: PFDNodeProps) {
  const color = '#0d9488';
  return (
    <Shell w={80} h={100} color={color} selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...hs(color), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out-vapor"
        style={{ ...hs(color), right: -4, top: '28%' }} />
      <Handle type="source" position={Position.Right} id="out-liquid"
        style={{ ...hs(color), right: -4, top: '72%' }} />
      <PFDSymbol type="flash" instruments={['PI', 'TI']} />
    </Shell>
  );
}

// ─── Splitter / CSplit — 1 in Left, 2 out Right (top 30%, bottom 70%) ────────

function PFDSplitterNode({ id, data, selected }: PFDNodeProps) {
  const color = '#7c3aed';
  return (
    <Shell w={100} h={80} color={color} selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...hs(color), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out-top"
        style={{ ...hs(color), right: -4, top: '30%' }} />
      <Handle type="source" position={Position.Right} id="out-bot"
        style={{ ...hs(color), right: -4, top: '70%' }} />
      <PFDSymbol type="splitter" />
    </Shell>
  );
}

function PFDCSplitNode({ id, data, selected }: PFDNodeProps) {
  const color = '#0891b2';
  return (
    <Shell w={100} h={80} color={color} selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...hs(color), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out-top"
        style={{ ...hs(color), right: -4, top: '28%' }} />
      <Handle type="source" position={Position.Right} id="out-bot"
        style={{ ...hs(color), right: -4, top: '72%' }} />
      <PFDSymbol type="csplit" />
    </Shell>
  );
}

// ─── Mixer — 2 in (Top, Bottom), 1 out (Right) ───────────────────────────────

function PFDMixerNode({ id, data, selected }: PFDNodeProps) {
  const color = '#059669';
  return (
    <Shell w={80} h={80} color={color} selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Top} id="in1"
        style={{ ...hs(color), top: -4 }} />
      <Handle type="target" position={Position.Bottom} id="in2"
        style={{ ...hs(color), bottom: -4 }} />
      <Handle type="source" position={Position.Right} id="out"
        style={{ ...hs(color), right: -4 }} />
      <PFDSymbol type="mixer" />
    </Shell>
  );
}

// ─── Purge — 1 in Left, out-vent Right top (28%), out-process Right bot (72%) ─

function PFDPurgeNode({ id, data, selected }: PFDNodeProps) {
  const color = '#ea580c';
  return (
    <Shell w={100} h={80} color={color} selected={selected} tag={data._pfdTag} label={data.label}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...hs(color), left: -4 }} />
      <Handle type="source" position={Position.Right} id="out-vent"
        style={{ ...hs(color), right: -4, top: '28%' }} />
      <Handle type="source" position={Position.Right} id="out-process"
        style={{ ...hs(color), right: -4, top: '72%' }} />
      <PFDSymbol type="purge" />
    </Shell>
  );
}

// ─── Feed — source only (Right) ───────────────────────────────────────────────

function PFDFeedNode({ id, data, selected }: PFDNodeProps) {
  const color = '#6b7280';
  return (
    <Shell w={80} h={70} color={color} selected={selected} label={data.label}>
      <Handle type="source" position={Position.Right} id="out"
        style={{ ...hs(color), right: -4 }} />
      <PFDSymbol type="feed" />
    </Shell>
  );
}

// ─── Product — target only (Left) ────────────────────────────────────────────

function PFDProductNode({ id, data, selected }: PFDNodeProps) {
  const color = '#16a34a';
  return (
    <Shell w={80} h={70} color={color} selected={selected} label={data.label}>
      <Handle type="target" position={Position.Left} id="in"
        style={{ ...hs(color), left: -4 }} />
      <PFDSymbol type="product" />
    </Shell>
  );
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const pfdNodeTypes = {
  cstr:      memo(PFDCSTRNode),
  pfr:       memo(PFDPFRNode),
  fixedbed:  memo(PFDFixedBedNode),
  batch:     memo(PFDBatchNode),
  semibatch: memo(PFDSemibatchNode),
  hx:        memo(PFDHXNode),
  flash:     memo(PFDFlashNode),
  pump:      memo(PFDPumpNode),
  comp:      memo(PFDCompNode),
  valve:     memo(PFDValveNode),
  mixer:     memo(PFDMixerNode),
  splitter:  memo(PFDSplitterNode),
  csplit:    memo(PFDCSplitNode),
  purge:     memo(PFDPurgeNode),
  feed:      memo(PFDFeedNode),
  product:   memo(PFDProductNode),
};

export type PFDNodeTypes = typeof pfdNodeTypes;
