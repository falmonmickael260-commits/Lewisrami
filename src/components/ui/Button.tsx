'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'text-ink-950 bg-[linear-gradient(175deg,#fbeec6_0%,#ecd08a_38%,#c79a45_100%)] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_10px_28px_-10px_rgba(217,178,99,0.75)] hover:brightness-[1.06]',
  secondary:
    'text-cream bg-white/8 border border-white/14 hover:bg-white/14 backdrop-blur-md',
  ghost: 'text-cream/80 hover:text-cream hover:bg-white/8',
  danger:
    'text-cream bg-ruby-600/85 border border-ruby-400/40 hover:bg-ruby-500/90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.82rem] rounded-xl gap-1.5',
  md: 'h-11 px-5 text-[0.92rem] rounded-2xl gap-2',
  lg: 'h-14 px-7 text-[1.02rem] rounded-2xl gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block = false, className = '', ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      whileHover={props.disabled ? undefined : { y: -1 }}
      whileTap={props.disabled ? undefined : { scale: 0.97, y: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 30 }}
      className={[
        'relative inline-flex items-center justify-center font-semibold tracking-tight',
        'transition-[background,color,opacity,filter] duration-200 will-animate no-select',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50',
        VARIANTS[variant],
        SIZES[size],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    />
  );
});
