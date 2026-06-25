import { motion } from "framer-motion";
import {
  Bot,
  ClipboardList,
  FileSpreadsheet,
  FolderKanban,
  Landmark,
  LineChart,
  Package,
  Receipt,
  Shield
} from "lucide-react";

const modules = [
  {
    icon: ClipboardList,
    title: "DPR Task Management",
    description:
      "Create, assign, and track detailed project report tasks. Approval workflows, ratings, overdue detection, comments, and structured report templates.",
    tags: ["Task lifecycle", "Templates", "Reviews", "DPR activities"]
  },
  {
    icon: FolderKanban,
    title: "Project & Numbering",
    description:
      "Multi-step project numbering wizard with company codes, technical units, and work categories. Requisition forms, financial prefill, and Excel import/export.",
    tags: ["Numbering wizard", "Requisition PDF", "Bulk import"]
  },
  {
    icon: Landmark,
    title: "Financial & RA Billing",
    description:
      "Per-project financial planning with normal and excess bill types. RA bill tracking from planning through received, carry-forward logic, and PDF export.",
    tags: ["RA bills", "Excess planning", "Bill status"]
  },
  {
    icon: Package,
    title: "Asset Management",
    description:
      "Full asset lifecycle — catalog by class/type, movements between projects, maintenance records, depreciation, purchase bills, and sold/disposed tracking.",
    tags: ["Movements", "Maintenance", "Excel import"]
  },
  {
    icon: Receipt,
    title: "Expense Tracker",
    description:
      "Employee expense sheets with categories, admin review workflow, voucher generation, and PDF exports matching company paper forms.",
    tags: ["Approval flow", "Vouchers", "Analytics"]
  },
  {
    icon: LineChart,
    title: "Executive Dashboard",
    description:
      "View-only HOD dashboard with organization filters, DPR status matrix, task summaries, financial bill status, and Gantt-style activity charts.",
    tags: ["Filters", "DPR matrix", "Gantt chart"]
  },
  {
    icon: Bot,
    title: "AI Assistant",
    description:
      "In-app chat assistant powered by LLM — create projects and tasks, manage team, query performance, list pending work, and download reports via natural language.",
    tags: ["Natural language", "Actions", "Reports"]
  },
  {
    icon: Shield,
    title: "Auth & Security",
    description:
      "JWT access and refresh tokens, bcrypt hashing, role-based route guards, rate limiting, request validation, and audit logging.",
    tags: ["RBAC", "JWT", "Audit logs"]
  },
  {
    icon: FileSpreadsheet,
    title: "Export Engine",
    description:
      "PDF and Excel generation across modules — employee reports, requisition forms, RA bills, expense summaries, vouchers, and bulk data templates.",
    tags: ["jsPDF", "Excel", "Templates"]
  }
];

export function Modules() {
  return (
    <section id="modules" className="section-pad bg-card/20">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14"
        >
          <p className="text-primary text-sm font-medium mb-2">Platform Modules</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything in one system</h2>
          <p className="text-muted-foreground max-w-2xl">
            Eight integrated modules covering operations, finance, assets, and executive visibility — not a collection
            of disconnected tools.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((mod, i) => (
            <motion.article
              key={mod.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass p-6 hover:border-primary/30 transition-colors group"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                <mod.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{mod.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">{mod.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {mod.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
