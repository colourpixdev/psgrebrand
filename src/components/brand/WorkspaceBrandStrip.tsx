import type { Workspace } from '../../types/domain';
import { getInitials } from '../../utils/profileIdentity';

function ColourpixFallbackMark() {
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-slate-950/70 p-2">
      <div className="grid w-full gap-1">
        <span className="h-1.5 rounded-full bg-cyan-300" />
        <span className="h-1.5 rounded-full bg-fuchsia-300" />
        <span className="h-1.5 rounded-full bg-yellow-200" />
        <span className="h-1.5 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

function BrandMark({ name, logoUrl, fallback }: { name: string; logoUrl?: string; fallback?: 'colourpix' }) {
  if (logoUrl) {
    return <img src={logoUrl} alt={`${name} logo`} className="h-12 w-12 rounded-2xl object-contain ring-1 ring-white/10" />;
  }

  if (fallback === 'colourpix') {
    return <ColourpixFallbackMark />;
  }

  return <div className="grid h-12 w-12 place-items-center rounded-2xl border border-sky-300/20 bg-sky-300/10 text-sm font-semibold text-sky-100">{getInitials(name)}</div>;
}

export function WorkspaceBrandStrip({ workspace }: { workspace: Workspace }) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-soft">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Workspace brands</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <article className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <BrandMark name={workspace.clientCompany} logoUrl={workspace.clientLogoUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{workspace.clientCompany}</p>
            <p className="text-xs leading-5 text-slate-500">Client workspace</p>
          </div>
        </article>
        <article className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <BrandMark name={workspace.graphicsPartner} logoUrl={workspace.servicePartnerLogoUrl} fallback="colourpix" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{workspace.graphicsPartner}</p>
            <p className="text-xs leading-5 text-slate-500">Workspace administrator / service partner</p>
          </div>
        </article>
      </div>
    </section>
  );
}
