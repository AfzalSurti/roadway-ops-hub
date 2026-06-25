import { motion } from "framer-motion";

const stats = [
  { value: "4", label: "User roles" },
  { value: "8+", label: "Core modules" },
  { value: "85+", label: "API endpoints" },
  { value: "25+", label: "App screens" }
];

export function StatsBar() {
  return (
    <section className="border-y border-border/40 bg-card/30">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="text-center"
            >
              <p className="text-3xl sm:text-4xl font-bold gradient-text">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
