import type { SelectHTMLAttributes, ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  children: ReactNode;
}

export default function Select({ className = '', children, ...rest }: SelectProps) {
  return (
    <select
      className={`text-[11px] border border-border-subtle rounded px-1.5 py-0.5 bg-surface text-text-secondary focus:outline-none focus:ring-1 focus:ring-primary ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
