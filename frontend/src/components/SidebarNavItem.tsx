import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
}

export function SidebarNavItem({ to, icon: Icon, label, collapsed }: SidebarNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <RouterNavLink
      to={to}
      className={cn(
        "nav-item group",
        isActive && "nav-item-active"
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </RouterNavLink>
  );
}
