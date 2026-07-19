import { useQuery } from '@tanstack/react-query';
import { productBrand } from '../constants/branding';
import { projectTemplateOptions } from '../constants/projectTemplates';
import { supabase } from '../lib/supabase';

function useDatabaseStatus() {
  return useQuery({
    queryKey: ['about-database-status'],
    queryFn: async () => {
      if (!supabase) {
        return 'Local preview data';
      }

      const { count, error } = await supabase.from('projects').select('id', { count: 'exact', head: true });
      if (error) {
        return `Supabase connected, project count unavailable: ${error.message}`;
      }

      return `Supabase live database (${count ?? 0} projects)`;
    },
  });
}

export function AboutPage() {
  const { data: databaseStatus = 'Checking database...' } = useDatabaseStatus();
  const rows = [
    ['Product Name', productBrand.name],
    ['Description', productBrand.description],
    ['Default Service Partner', productBrand.partner],
    ['Current Client', productBrand.customer],
    ['Current Workspace', productBrand.workspace],
    ['Available Project Templates', projectTemplateOptions.map((template) => template.name).join(', ')],
    ['Version', productBrand.version],
    ['Database', databaseStatus],
    ['License Status', productBrand.licenseStatus],
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/10 bg-white/6 p-6 shadow-soft">
        <p className="text-sm uppercase tracking-[0.32em] text-teal-200/80">About</p>
        <h2 className="mt-3 text-3xl font-semibold text-white">{productBrand.name}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          {productBrand.description} for client workspaces, project templates, controlled users, supplier coordination, project journals, voice updates, files, and reporting.
        </p>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm font-medium text-white">{value}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}