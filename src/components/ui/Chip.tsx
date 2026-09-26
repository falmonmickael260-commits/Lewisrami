export function Chip({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'gold' | 'good' | 'warn' | 'bad';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/8 text-cream/75 border-white/12',
    gold: 'bg-gold-500/15 text-gold-300 border-gold-500/35',
    good: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30',
    warn: 'bg-amber-400/15 text-amber-200 border-amber-300/30',
    bad: 'bg-ruby-500/18 text-ruby-400 border-ruby-400/35',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.09em] ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
