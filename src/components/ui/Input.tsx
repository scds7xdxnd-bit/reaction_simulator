import type { InputHTMLAttributes } from 'react';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export default function Input({ className = '', ...rest }: InputProps) {
  return (
    <input
      className={`text-[11px] font-mono bg-surface-elevated border border-border-subtle rounded px-1.5 py-0.5 text-text-primary outline-none focus:border-primary ${className}`}
      {...rest}
    />
  );
}
