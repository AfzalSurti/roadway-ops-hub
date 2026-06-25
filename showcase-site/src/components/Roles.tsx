import { motion } from "framer-motion";
import { Briefcase, Crown, HardHat, Settings2 } from "lucide-react";

const roles = [
  {
    icon: Settings2,
    role: "DPR Admin",
    color: "from-primary/20 to-primary/5 border-primary/30",
    iconColor: "text-primary",
    description: "Full operational control — tasks, reports, team, projects, financials, and expenses.",
    access: [
      "Create & assign DPR tasks",
      "Review and approve reports",
      "Manage employees & workload",
      "Project numbering & requisition",
      "Financial planning & RA bills",
      "Expense review & vouchers",
      "Report templates & AI assistant"
    ]
  },
  {
    icon: Briefcase,
    role: "PMO / Administrative",
    color: "from-accent/20 to-accent/5 border-accent/30",
    iconColor: "text-accent",
    description: "Project administration and asset operations without full DPR task control.",
    access: [
      "Project management & numbering",
      "Requisition form generation",
      "Asset create, edit & catalog",
      "Asset movements & maintenance",
      "Bulk asset import/export",
      "Purchase bill uploads"
    ]
  },
  {
    icon: Crown,
    role: "HOD / Management",
    color: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    iconColor: "text-amber-400",
    description: "Executive view-only dashboard — monitor progress without operational entry.",
    access: [
      "Organization & unit filters",
      "Project portfolio overview",
      "DPR status matrix",
      "Task completion summaries",
      "Financial bill status",
      "Activity Gantt charts"
    ]
  },
  {
    icon: HardHat,
    role: "Employee",
    color: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
    iconColor: "text-violet-400",
    description: "Field and desk staff — execute assigned work and submit structured outputs.",
    access: [
      "View assigned tasks",
      "Submit template-based reports",
      "Update task status & comments",
      "Personal dashboard & profile",
      "Expense sheet creation",
      "Track submission history"
    ]
  }
];

export function Roles() {
  return (
    <section id="roles" className="section-pad">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <p className="text-primary text-sm font-medium mb-2">Role-Based Access</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for every stakeholder</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Four distinct user roles with separate navigation, permissions, and screens — from field employees to
            senior management.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {roles.map((r, i) => (
            <motion.div
              key={r.role}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-2xl border bg-gradient-to-br p-6 ${r.color}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl bg-background/50 ${r.iconColor}`}>
                  <r.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{r.role}</h3>
                  <p className="text-xs text-muted-foreground">Dedicated route tree &amp; API guards</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">{r.description}</p>
              <ul className="space-y-2">
                {r.access.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
