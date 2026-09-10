import {
  BarChart3,
  GitBranch,
  LayoutDashboard,
  Repeat,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { NavItem } from "@/lib/constants";

const MAP: Record<NavItem["icon"], LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  target: Target,
  "git-branch": GitBranch,
  "bar-chart-3": BarChart3,
  repeat: Repeat,
  settings: Settings,
};

export function NavIcon({ name, className }: { name: NavItem["icon"]; className?: string }) {
  const Icon = MAP[name];
  return <Icon className={className} />;
}
