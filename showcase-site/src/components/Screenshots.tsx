import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrowserFrame } from "@/components/mocks/BrowserFrame";
import {
  MockDashboard,
  MockProjects,
  MockAssets,
  MockExpenses,
  MockHodDashboard,
  MockFinancial,
  MockPmoPortal,
  MockEmployeePortal
} from "@/components/mocks/MockScreens";
import { Briefcase, Crown, HardHat, Settings2 } from "lucide-react";

const roles = [
  {
    id: "admin",
    label: "DPR Admin",
    icon: Settings2,
    color: "text-primary",
    title: "app.opsforge.io/admin/dashboard",
    description: "Full operations — tasks, reports, team, projects, financials & expenses",
    component: MockDashboard,
    extras: [
      { id: "admin-projects", label: "Projects", component: MockProjects, title: "app.opsforge.io/admin/projects" },
      { id: "admin-financial", label: "Financial", component: MockFinancial, title: "app.opsforge.io/admin/financial" },
      { id: "admin-expenses", label: "Expenses", component: MockExpenses, title: "app.opsforge.io/admin/expenses" }
    ]
  },
  {
    id: "pmo",
    label: "PMO",
    icon: Briefcase,
    color: "text-accent",
    title: "app.opsforge.io/administrative/project-management",
    description: "Project numbering, requisition PDFs, and asset management",
    component: MockPmoPortal,
    extras: [
      { id: "pmo-assets", label: "Assets", component: MockAssets, title: "app.opsforge.io/administrative/assets" }
    ]
  },
  {
    id: "hod",
    label: "HOD / Management",
    icon: Crown,
    color: "text-amber-400",
    title: "app.opsforge.io/hod/dashboard",
    description: "View-only executive dashboard — filters, DPR matrix & billing status",
    component: MockHodDashboard,
    extras: []
  },
  {
    id: "employee",
    label: "Employee",
    icon: HardHat,
    color: "text-violet-400",
    title: "app.opsforge.io/app/tasks",
    description: "Assigned tasks, structured report submission & expense sheets",
    component: MockEmployeePortal,
    extras: []
  }
];

export function Screenshots() {
  const [activeRole, setActiveRole] = useState(roles[0].id);
  const [activeView, setActiveView] = useState<string | null>(null);

  const role = roles.find((r) => r.id === activeRole) ?? roles[0];
  const allViews = [{ id: "main", label: "Main screen", component: role.component, title: role.title }, ...role.extras];
  const currentView = activeView
    ? allViews.find((v) => v.id === activeView) ?? allViews[0]
    : allViews[0];
  const Mock = currentView.component;

  const selectRole = (id: string) => {
    setActiveRole(id);
    setActiveView(null);
  };

  return (
    <section id="screenshots" className="section-pad">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm font-medium mb-2">Product Screens</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for all 4 user roles</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Each role gets its own navigation, permissions, and screens — from field employees to senior management.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {roles.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectRole(r.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                activeRole === r.id
                  ? "border-primary/40 bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border/50 hover:border-border bg-card/30"
              }`}
            >
              <r.icon className={`h-5 w-5 mb-2 ${r.color}`} />
              <p className="font-semibold text-sm">{r.label}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.description}</p>
            </button>
          ))}
        </div>

        {allViews.length > 1 ? (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {allViews.map((view) => (
              <button
                key={view.id}
                type="button"
                onClick={() => setActiveView(view.id === "main" ? null : view.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  (view.id === "main" && !activeView) || activeView === view.id
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={`${activeRole}-${activeView ?? "main"}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="max-w-4xl mx-auto"
          >
            <BrowserFrame title={currentView.title}>
              <Mock />
            </BrowserFrame>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Screenshot-ready · Switch roles above to preview each user&apos;s experience
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
