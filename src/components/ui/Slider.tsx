import type { InputHTMLAttributes } from 'react';

type SliderProps = InputHTMLAttributes<HTMLInputElement>;

export default function Slider({ className = '', ...rest }: SliderProps) {
  return (
    <input
      type="range"
      className={`w-full accent-primary cursor-pointer ${className}`}
      {...rest}
    />
  );
}
