import { BellRing, CalendarClock, ClipboardCheck, LayoutDashboard, Map, Settings, ShieldAlert, Sparkles, type LucideIcon } from "lucide-react";
export const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/farm", label: "My Farm", icon: Map }, { href: "/risks", label: "Risk Center", icon: ShieldAlert }, { href: "/plans", label: "Advisory Plans", icon: Sparkles }, { href: "/tasks", label: "Tasks", icon: ClipboardCheck }, { href: "/alerts", label: "Alerts", icon: BellRing }, { href: "/timeline", label: "Timeline", icon: CalendarClock }, { href: "/settings", label: "Settings", icon: Settings },
];
