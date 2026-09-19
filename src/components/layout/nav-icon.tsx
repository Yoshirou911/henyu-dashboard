import {
  BarChart3,
  BookOpen,
  FileText,
  Flag,
  GitBranch,
  GraduationCap,
  LayoutDashboard,
  Repeat,
  Settings,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/constants";

const MAP: Record<NavIconName, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  target: Target,
  "git-branch": GitBranch,
  "bar-chart-3": BarChart3,
  repeat: Repeat,
  settings: Settings,
  "book-open": BookOpen,
  "alert-triangle": TriangleAlert,
  "graduation-cap": GraduationCap,
  "file-text": FileText,
  flag: Flag,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = MAP[name];
  return <Icon className={className} />;
}
