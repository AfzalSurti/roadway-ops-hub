import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { SidebarNavItem } from "@/components/SidebarNavItem";
import {
  LayoutDashboard,
  ListTodo,
  Users,
  FolderKanban,
  FileCheck,
  Landmark,
  ChevronLeft,
  ChevronRight,
  LogOut,
  UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const adminNav = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/tasks", icon: ListTodo, label: "Tasks" },
  { to: "/admin/reports", icon: FileCheck, label: "Reports" },
  { to: "/admin/financial", icon: Landmark, label: "Financial" },
  { to: "/admin/team", icon: Users, label: "Team" },
  { to: "/admin/projects", icon: FolderKanban, label: "Projects" },
];

const employeeNav = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/tasks", icon: ListTodo, label: "My Tasks" },
  { to: "/app/reports", icon: FileCheck, label: "My Reports" },
  { to: "/app/profile", icon: UserCircle, label: "My Profile" },
];

export function AppSidebar() {
  const { user, isAdmin, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = isAdmin ? adminNav : employeeNav;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 256 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border z-40"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3 overflow-hidden">
          <img src="/roadway-logo.svg" alt="Sankalp" className="w-8 h-8 rounded-lg shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-foreground whitespace-nowrap overflow-hidden"
              >
                Sankalp
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SidebarNavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-2">
        {user && (
          <div className={cn("flex items-center gap-3 px-3 py-2", collapsed && "justify-center")}>
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full shrink-0" />
            {!collapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            )}
          </div>
        )}
        <button onClick={logout} className={cn("nav-item w-full text-destructive hover:text-destructive", collapsed && "justify-center")}>
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full justify-center"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
