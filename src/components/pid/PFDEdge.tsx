/**
 * F21 — PFD custom edge: renders a smoothstep path with a rotated-square (diamond)
 * stream label when a stream label is present (e.g. "S01").
 */
import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';

function PFDEdge({
  id,
  sourceX, sourceY, sourcePosition,
  targetX, targetY, targetPosition,
  style,
  markerEnd,
  label,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 10,
            }}
            className="nodrag nopan"
          >
            {/* Outer diamond (rotated square) */}
            <div style={{
              width: 26, height: 26,
              transform: 'rotate(45deg)',
              background: '#f8faff',
              border: '1.5px solid #374151',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {/* Inner label — counter-rotate so text reads normally */}
              <span style={{
                transform: 'rotate(-45deg)',
                fontSize: 7, fontWeight: 700,
                color: '#374151', fontFamily: 'monospace',
                whiteSpace: 'nowrap',
              }}>
                {label as string}
              </span>
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(PFDEdge);
