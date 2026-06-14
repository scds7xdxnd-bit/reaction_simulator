/**
 * F21 — ISA-5.1 / ISO 10628-flavoured PFD SVG symbols.
 * All symbols use viewBox="0 0 100 100", stroke=currentColor, fill=none.
 * Sizing is controlled by the parent — symbols fill 100% of their container.
 */

export type PFDSymbolType =
  | 'cstr' | 'pfr' | 'fixedbed' | 'batch' | 'semibatch'
  | 'hx' | 'flash' | 'pump' | 'comp' | 'valve'
  | 'mixer' | 'splitter' | 'csplit' | 'purge'
  | 'feed' | 'product';

interface Props {
  type: PFDSymbolType;
  /** instrument bubble codes to overlay, e.g. ['TC', 'FI'] */
  instruments?: string[];
}

/** Single circle instrument bubble at the given position (normalised 0–100 coords). */
function Bubble({ code, cx, cy }: { code: string; cx: number; cy: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="9" fill="white" stroke="currentColor" strokeWidth="1.5" />
      <text x={cx} y={cy + 2.5} textAnchor="middle" fontSize="6" fontFamily="monospace" fill="currentColor">
        {code}
      </text>
    </g>
  );
}

const SW  = 2;    // main stroke width
const SWt = 1.5;  // thin stroke width

export function PFDSymbol({ type, instruments }: Props) {
  let body: React.ReactNode;

  switch (type) {
    case 'cstr':
      body = (
        <>
          <rect x="18" y="12" width="64" height="72" rx="5" fill="none" stroke="currentColor" strokeWidth={SW}/>
          <line x1="50" y1="12" x2="50" y2="54" stroke="currentColor" strokeWidth={SWt}/>
          <line x1="20" y1="54" x2="80" y2="54" stroke="currentColor" strokeWidth={SW}/>
          <line x1="20" y1="64" x2="36" y2="54" stroke="currentColor" strokeWidth={SWt}/>
          <line x1="80" y1="64" x2="64" y2="54" stroke="currentColor" strokeWidth={SWt}/>
          <circle cx="50" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth={SWt}/>
        </>
      );
      break;

    case 'pfr':
      body = (
        <>
          <rect x="6" y="30" width="88" height="40" rx="20" fill="none" stroke="currentColor" strokeWidth={SW}/>
          <line x1="25" y1="50" x2="60" y2="50" stroke="currentColor" strokeWidth={SWt}/>
          <polyline points="54,43 62,50 54,57" fill="none" stroke="currentColor" strokeWidth={SWt}/>
        </>
      );
      break;

    case 'fixedbed':
      body = (
        <>
          <rect x="25" y="8" width="50" height="84" rx="4" fill="none" stroke="currentColor" strokeWidth={SW}/>
          {/* Support grids */}
          <line x1="25" y1="22" x2="75" y2="22" stroke="currentColor" strokeWidth={SWt} strokeDasharray="3,2"/>
          <line x1="25" y1="78" x2="75" y2="78" stroke="currentColor" strokeWidth={SWt} strokeDasharray="3,2"/>
          {/* Catalyst packing hatching */}
          <line x1="30" y1="30" x2="68" y2="68" stroke="currentColor" strokeWidth={1}/>
          <line x1="30" y1="44" x2="55" y2="69" stroke="currentColor" strokeWidth={1}/>
          <line x1="44" y1="30" x2="69" y2="55" stroke="currentColor" strokeWidth={1}/>
          <line x1="30" y1="58" x2="42" y2="70" stroke="currentColor" strokeWidth={1}/>
          <line x1="57" y1="30" x2="70" y2="43" stroke="currentColor" strokeWidth={1}/>
        </>
      );
      break;

    case 'batch':
      body = (
        <>
          <rect x="18" y="12" width="64" height="72" rx="5" fill="none" stroke="currentColor" strokeWidth={SW}/>
          {/* Level line */}
          <line x1="18" y1="58" x2="82" y2="58" stroke="currentColor" strokeWidth={SWt} strokeDasharray="5,3"/>
        </>
      );
      break;

    case 'semibatch':
      body = (
        <>
          <rect x="18" y="12" width="64" height="72" rx="5" fill="none" stroke="currentColor" strokeWidth={SW}/>
          <line x1="18" y1="58" x2="82" y2="58" stroke="currentColor" strokeWidth={SWt} strokeDasharray="5,3"/>
          {/* Feed nozzle stub at top */}
          <line x1="50" y1="2" x2="50" y2="12" stroke="currentColor" strokeWidth={SWt}/>
          <circle cx="50" cy="2" r="2" fill="currentColor"/>
        </>
      );
      break;

    case 'hx':
      body = (
        <>
          <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth={SW}/>
          {/* Process stream (horizontal) */}
          <line x1="12" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth={SWt}/>
          {/* Utility stream (vertical) */}
          <line x1="50" y1="12" x2="50" y2="88" stroke="currentColor" strokeWidth={SWt}/>
        </>
      );
      break;

    case 'flash':
      body = (
        <>
          <rect x="28" y="6" width="44" height="88" rx="10" fill="none" stroke="currentColor" strokeWidth={SW}/>
          {/* Demister pad dashes */}
          <line x1="33" y1="22" x2="67" y2="22" stroke="currentColor" strokeWidth={SWt} strokeDasharray="4,2"/>
          <line x1="33" y1="28" x2="67" y2="28" stroke="currentColor" strokeWidth={SWt} strokeDasharray="4,2"/>
          {/* V / L labels */}
          <text x="72" y="34" fontSize="8" fontFamily="monospace" fill="currentColor">V</text>
          <text x="72" y="76" fontSize="8" fontFamily="monospace" fill="currentColor">L</text>
        </>
      );
      break;

    case 'pump':
      body = (
        <>
          <circle cx="50" cy="56" r="34" fill="none" stroke="currentColor" strokeWidth={SW}/>
          {/* Impeller triangle */}
          <polygon points="28,40 28,72 74,56" fill="none" stroke="currentColor" strokeWidth={SWt}/>
          {/* Discharge nozzle upward */}
          <line x1="50" y1="22" x2="50" y2="8" stroke="currentColor" strokeWidth={SWt}/>
        </>
      );
      break;

    case 'comp':
      body = (
        <>
          {/* Trapezoid: wide-mouth at left (inlet), narrow at right (outlet) */}
          <polygon points="8,80 8,20 92,36 92,64" fill="none" stroke="currentColor" strokeWidth={SW}/>
        </>
      );
      break;

    case 'valve':
      body = (
        <>
          {/* Bowtie body */}
          <polygon points="8,18 8,82 50,50" fill="none" stroke="currentColor" strokeWidth={SWt}/>
          <polygon points="92,18 92,82 50,50" fill="none" stroke="currentColor" strokeWidth={SWt}/>
          {/* Actuator stem */}
          <line x1="50" y1="50" x2="50" y2="8" stroke="currentColor" strokeWidth={SWt}/>
          <rect x="42" y="2" width="16" height="8" fill="none" stroke="currentColor" strokeWidth={SWt}/>
        </>
      );
      break;

    case 'mixer':
      body = (
        <>
          {/* Top and bottom inputs meet at centre, right output */}
          <line x1="50" y1="2"  x2="50" y2="50" stroke="currentColor" strokeWidth={SW}/>
          <line x1="50" y1="98" x2="50" y2="50" stroke="currentColor" strokeWidth={SW}/>
          <line x1="50" y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth={SW}/>
          <circle cx="50" cy="50" r="4" fill="currentColor"/>
        </>
      );
      break;

    case 'splitter':
    case 'csplit':
      body = (
        <>
          {/* Left input, upper-right and lower-right outputs */}
          <line x1="2"  y1="50" x2="45" y2="50" stroke="currentColor" strokeWidth={SW}/>
          <line x1="45" y1="50" x2="98" y2="22" stroke="currentColor" strokeWidth={SW}/>
          <line x1="45" y1="50" x2="98" y2="78" stroke="currentColor" strokeWidth={SW}/>
          <circle cx="45" cy="50" r="4" fill="currentColor"/>
        </>
      );
      break;

    case 'purge':
      body = (
        <>
          {/* Through stream */}
          <line x1="2"  y1="50" x2="98" y2="50" stroke="currentColor" strokeWidth={SW}/>
          {/* Vent branch going up-right */}
          <line x1="50" y1="50" x2="76" y2="8"  stroke="currentColor" strokeWidth={SW}/>
          {/* Vent arrow tip */}
          <polyline points="64,10 78,6 74,18" fill="none" stroke="currentColor" strokeWidth={SWt}/>
          <circle cx="50" cy="50" r="4" fill="currentColor"/>
        </>
      );
      break;

    case 'feed':
      body = (
        <>
          {/* Pentagon off-page connector pointing right */}
          <polygon points="4,14 68,14 96,50 68,86 4,86" fill="none" stroke="currentColor" strokeWidth={SW}/>
          <line x1="22" y1="50" x2="62" y2="50" stroke="currentColor" strokeWidth={SWt}/>
          <polyline points="56,43 64,50 56,57" fill="none" stroke="currentColor" strokeWidth={SWt}/>
        </>
      );
      break;

    case 'product':
      body = (
        <>
          {/* Pentagon off-page connector (right-indent) */}
          <polygon points="4,14 96,14 96,86 4,86 32,50" fill="none" stroke="currentColor" strokeWidth={SW}/>
          <line x1="36" y1="50" x2="76" y2="50" stroke="currentColor" strokeWidth={SWt}/>
          <polyline points="70,43 78,50 70,57" fill="none" stroke="currentColor" strokeWidth={SWt}/>
        </>
      );
      break;

    default:
      body = (
        <rect x="10" y="10" width="80" height="80" rx="4" fill="none" stroke="currentColor" strokeWidth={SW}/>
      );
  }

  return (
    <svg
      width="100%" height="100%"
      viewBox="0 0 100 100"
      overflow="visible"
      style={{ display: 'block' }}
    >
      {body}
      {/* Instrument bubbles — placed at upper-right of symbol */}
      {instruments?.map((code, i) => (
        <Bubble key={code} code={code} cx={88} cy={12 + i * 22} />
      ))}
    </svg>
  );
}
