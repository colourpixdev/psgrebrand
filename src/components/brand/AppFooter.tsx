import { Link } from 'react-router-dom';
import { productBrand } from '../../constants/branding';

export function AppFooter() {
  return (
    <footer className="mt-10 border-t border-white/10 pt-5 text-xs text-slate-500">
      <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        <span>{productBrand.poweredBy}</span>
        <span>Version {productBrand.version}</span>
        <span>{productBrand.copyright}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <Link to="/support" className="transition hover:text-slate-300">Support</Link>
        <Link to="/about" className="transition hover:text-slate-300">About</Link>
        <Link to="/legal" className="transition hover:text-slate-300">Legal</Link>
      </div>
    </footer>
  );
}