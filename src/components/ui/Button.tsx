import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
}

const VARIANT: Record<Variant, string> = {
  primary:   'bg-primary text-white hover:bg-primary-hover',
  secondary: 'border border-border-subtle bg-surface text-text-secondary hover:bg-[#f0f4ff]',
  ghost:     'text-text-muted hover:text-primary hover:bg-surface-elevated',
  danger:    'border border-[#fca5a5] bg-[#fef2f2] text-danger hover:bg-[#fee2e2]',
};

const SIZE: Record<Size, string> = {
  sm: 'px-2 py-0.5 text-[11px]',
  md: 'px-3 py-1   text-[11px]',
};

export default function Button({
  variant  = 'secondary',
  size     = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1 rounded font-medium transition-colors ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
