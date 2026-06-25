import { motion } from "framer-motion";

const stack = {
  frontend: ["React 18", "TypeScript", "Vite", "Tailwind CSS", "shadcn/ui", "React Query", "Recharts", "Framer Motion"],
  backend: ["Node.js", "Express", "Prisma ORM", "Zod", "JWT", "bcrypt", "Pino", "Multer"],
  data: ["PostgreSQL", "Neon", "26 DB models", "17 migrations"],
  integrations: ["Groq AI (LLM)", "Resend / SMTP", "jsPDF", "SheetJS (xlsx)", "Vercel", "Render"]
};

export function TechStack() {
  return (
    <section className="section-pad">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <p className="text-primary text-sm font-medium mb-2">Technology</p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Modern full-stack architecture</h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Object.entries(stack).map(([category, items], i) => (
            <motion.div
              key={category}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="glass p-5"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider text-primary mb-4">{category}</h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-accent" />
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
