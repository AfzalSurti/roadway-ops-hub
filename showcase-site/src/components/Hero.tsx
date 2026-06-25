import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { BrowserFrame } from "@/components/mocks/BrowserFrame";
import { MockDashboard } from "@/components/mocks/MockScreens";

export function Hero() {
  return (
    <section className="section-pad pt-32 sm:pt-40 pb-16">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Full-stack enterprise platform — already built &amp; deployed
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6"
            >
              One platform for{" "}
              <span className="gradient-text">engineering operations</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-lg text-muted-foreground leading-relaxed max-w-xl mb-8"
            >
              A production-ready web application for consultancies and infrastructure teams — DPR task workflows,
              project numbering, financial billing, asset lifecycle, expense tracking, and executive dashboards.
              Role-based access for every stakeholder.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <a
                href="#screenshots"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
              >
                Explore the product
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border/60 text-foreground font-medium hover:bg-muted/50 transition-colors"
              >
                Need something similar?
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.25 }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-2xl opacity-60" />
            <BrowserFrame title="Admin Dashboard" className="relative animate-float">
              <MockDashboard />
            </BrowserFrame>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
