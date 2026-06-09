import type { ButtonHTMLAttributes } from 'react';

type Size = 'sm' | 'md';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  size?: Size;
  active?: boolean;
}

const SIZE: Record<Size, string> = {
  sm: 'w-8 h-8',
  md: 'w-11 h-11',
};

export default function IconButton({
  size    = 'md',
  active  = false,
  className = '',
  children,
  ...rest
}: IconButtonProps) {
  const activeClass = active
    ? 'border-primary bg-primary-light'
    : 'border-border-subtle bg-surface-elevated hover:border-primary hover:bg-primary-light';

  return (
    <button
      className={`inline-flex items-center justify-center rounded-md border transition-colors ${SIZE[size]} ${activeClass} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
