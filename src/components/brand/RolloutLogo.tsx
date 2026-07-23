import { cn } from '../../lib/utils';
import { psgPrimaryLogoUrl } from '../../constants/branding';

export function RolloutLogo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <img
        src={psgPrimaryLogoUrl}
        alt="PSG logo"
        className={cn('h-11 w-11 shrink-0 object-contain', markClassName)}
      />
      <span className="sr-only">PSG Rebrand</span>
    </div>
  );
}