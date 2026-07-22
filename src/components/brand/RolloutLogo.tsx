import { cn } from '../../lib/utils';

export function RolloutLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <img
        src={`${import.meta.env.BASE_URL}brand/psg-flower-cyan.svg`}
        alt="PSG flower logo"
        className={cn('h-11 w-11 shrink-0 object-contain', markClassName)}
      />
      <span className="sr-only">PSG Rebrand</span>
    </div>
  );
}