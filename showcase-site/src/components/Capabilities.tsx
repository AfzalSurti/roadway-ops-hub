import { motion } from "framer-motion";
import {
  Bell,
  Cloud,
  Database,
  FileText,
  Lock,
  Mail,
  RefreshCw,
  Upload,
  Zap
} from "lucide-react";

const capabilities = [
  { icon: Lock, title: "JWT Authentication", detail: "Access + refresh token rotation with secure httpOnly-style flow" },
  { icon: Database, title: "PostgreSQL + Prisma", detail: "26 data models, typed ORM, migration pipeline" },
  { icon: FileText, title: "Dynamic Report Templates", detail: "JSON-schema templates with snapshot on submission" },
  { icon: Upload, title: "File Uploads", detail: "Multer-based attachments for tasks, reports, and assets" },
  { icon: Mail, title: "Email Notifications", detail: "Welcome emails and transactional delivery via SMTP/Resend" },
  { icon: Bell, title: "In-App Notifications", detail: "Real-time notification list with read/unread state" },
  { icon: RefreshCw, title: "Live Data Sync", detail: "React Query with auto-refetch and optimistic updates" },
  { icon: Cloud, title: "Cloud Deployed", detail: "Production on Vercel (frontend) + Render (backend) + Neon DB" },
  { icon: Zap, title: "Cold-Start Handling", detail: "Branded loading experience while backend wakes on free tier" }
];

export function Capabilities() {
  return (
    <section id="capabilities" className="section-pad bg-card/20">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <p className="text-primary text-sm font-medium mb-2">Under the Hood</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Production-grade features</h2>
          <p className="text-muted-foreground max-w-2xl">
            Not a prototype — a deployed system with real auth, validation, exports, integrations, and infrastructure.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="flex gap-4 p-4 rounded-xl border border-border/40 bg-background/50 hover:border-primary/25 transition-colors"
            >
              <div className="shrink-0 p-2 h-fit rounded-lg bg-primary/10 text-primary">
                <cap.icon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm mb-1">{cap.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{cap.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
