import { useState } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

export default function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: 'absolute',
            left: 72,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#1e293b',
            color: '#f1f5f9',
            borderRadius: 6,
            padding: '5px 10px',
            pointerEvents: 'none',
            zIndex: 200,
            whiteSpace: 'nowrap',
            fontSize: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
