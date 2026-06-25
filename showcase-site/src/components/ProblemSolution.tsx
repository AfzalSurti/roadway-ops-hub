import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Layers,
  RefreshCw,
  Sparkles,
  XCircle
} from "lucide-react";

const painPoints = [
  {
    icon: FileSpreadsheet,
    title: "Everything lives in Excel",
    detail:
      "Projects, tasks, DPR status, assets, and expenses scattered across dozens of spreadsheets — hard to maintain and impossible to search in one place."
  },
  {
    icon: RefreshCw,
    title: "Manual report tracking",
    detail:
      "Managers chase employees over email and WhatsApp to know who submitted reports, what's overdue, and which DPR stage each project is in."
  },
  {
    icon: FileText,
    title: "PDFs built by hand",
    detail:
      "Requisition forms, RA bills, expense vouchers, and employee reports copied from Excel into Word — hours of formatting every week."
  },
  {
    icon: AlertTriangle,
    title: "Billing & finance in silos",
    detail:
      "RA bill amounts, excess planning, and project financials tracked separately — no live link between operations and billing status."
  },
  {
    icon: XCircle,
    title: "No executive visibility",
    detail:
      "Senior management gets delayed summaries instead of a real-time view across organizations, units, and project portfolios."
  }
];

const solutions = [
  "One centralized platform — projects, tasks, reports, finance, assets, and expenses",
  "Structured DPR task workflows with templates, approvals, ratings, and overdue alerts",
  "Auto-generated PDFs — requisition forms, RA bills, expense vouchers, and reports",
  "Role-based dashboards for Admin, PMO, HOD, and field employees",
  "Project numbering wizard, Excel import/export, and live financial bill tracking",
  "Executive view-only dashboard with filters, DPR matrix, and activity Gantt charts"
];

export function ProblemSolution() {
  return (
    <section id="problem" className="section-pad bg-card/20">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <p className="text-primary text-sm font-medium mb-2">Why this exists</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">From Excel chaos to one system</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Engineering consultancies often run on spreadsheets for years. This platform replaces that manual
            workflow with a production-ready web application.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
                <XCircle className="h-4 w-4" />
              </span>
              <h3 className="text-xl font-bold">Before — the Excel problem</h3>
            </div>
            <div className="space-y-4">
              {painPoints.map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex gap-4 p-4 rounded-xl border border-red-500/15 bg-red-500/5"
                >
                  <item.icon className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm mb-1">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex items-center gap-2 mb-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Sparkles className="h-4 w-4" />
              </span>
              <h3 className="text-xl font-bold">After — the platform solution</h3>
            </div>
            <div className="glass p-6 sm:p-8 mb-6">
              <div className="flex items-center gap-3 mb-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                  <Layers className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-bold text-lg">OpsForge Platform</p>
                  <p className="text-xs text-muted-foreground">Built, deployed &amp; production-ready</p>
                </div>
              </div>
              <ul className="space-y-3">
                {solutions.map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: 8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 text-sm"
                  >
                    <CheckCircle2 className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
            <a
              href="#screenshots"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              See all 4 user role screens
              <ArrowRight className="h-4 w-4" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
