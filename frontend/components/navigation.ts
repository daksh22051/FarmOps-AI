import {
  LayoutDashboard,
  Home,
  Layers,
  ShieldAlert,
  ClipboardCheck,
  ListTodo,
  Bell,
  Send,
  Clock,
  BarChart3,
  Sliders,
  Settings,
  PlusCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/onboarding", label: "Setup New Farm", icon: PlusCircle },
  { href: "/farm", label: "Farms", icon: Home },
  { href: "/zones", label: "Zones", icon: Layers },
  { href: "/risks", label: "Risks", icon: ShieldAlert },
  { href: "/plans", label: "Action Plans", icon: ClipboardCheck },
  { href: "/tasks", label: "Tasks", icon: ListTodo },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/escalations", label: "Escalations", icon: Send },
  { href: "/timeline", label: "Timeline", icon: Clock },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/demo", label: "Demo Controls", icon: Sliders },
  { href: "/settings", label: "Settings", icon: Settings },
];
