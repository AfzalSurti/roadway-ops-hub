import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BrowserFrame } from "@/components/mocks/BrowserFrame";
import {
  MockDashboard,
  MockProjects,
  MockAssets,
  MockExpenses,
  MockHodDashboard,
  MockFinancial
} from "@/components/mocks/MockScreens";

const screens = [
  { id: "dashboard", label: "Admin Dashboard", title: "app.opsforge.io/admin/dashboard", component: MockDashboard },
  { id: "projects", label: "Projects", title: "app.opsforge.io/admin/projects", component: MockProjects },
  { id: "financial", label: "Financial", title: "app.opsforge.io/admin/financial", component: MockFinancial },
  { id: "assets", label: "Assets", title: "app.opsforge.io/assets", component: MockAssets },
  { id: "expenses", label: "Expenses", title: "app.opsforge.io/expenses", component: MockExpenses },
  { id: "hod", label: "HOD View", title: "app.opsforge.io/hod/dashboard", component: MockHodDashboard }
];

export function Screenshots() {
  const [active, setActive] = useState(screens[0].id);
  const current = screens.find((s) => s.id === active) ?? screens[0];
  const Mock = current.component;

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
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">See what the platform looks like</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Real UI patterns from a live production system — dark theme, role-based navigation, dashboards, and
            data-heavy workflows built for engineering teams.
          </p>
        </motion.div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {screens.map((screen) => (
            <button
              key={screen.id}
              type="button"
              onClick={() => setActive(screen.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                active === screen.id
                  ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20"
                  : "border border-border/50 text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              {screen.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="max-w-4xl mx-auto"
          >
            <BrowserFrame title={current.title}>
              <Mock />
            </BrowserFrame>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Screenshot-ready mock · Switch tabs above to preview each module
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
