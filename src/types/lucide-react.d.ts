declare module 'lucide-react' {
  import type { ComponentType, SVGProps } from 'react';

  export type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>;

  export const LayoutDashboard: LucideIcon;
  export const KanbanSquare: LucideIcon;
  export const FileText: LucideIcon;
  export const Shield: LucideIcon;
  export const Search: LucideIcon;
  export const Users: LucideIcon;
  export const MapPinned: LucideIcon;
  export const LogOut: LucideIcon;
  export const Sparkles: LucideIcon;
}