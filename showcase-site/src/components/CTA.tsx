import { motion } from "framer-motion";
import { ArrowUpRight, MessageCircle } from "lucide-react";

export function CTA() {
  return (
    <section id="contact" className="section-pad">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-10 sm:p-14 text-center"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Need a platform like this?</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
              I&apos;ve already designed, built, and deployed this end-to-end — from database schema to PDF exports
              and executive dashboards. Let&apos;s talk about building something similar for your team.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://www.linkedin.com/in/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/25"
              >
                <MessageCircle className="h-4 w-4" />
                Message on LinkedIn
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-6">
              Replace the LinkedIn link above with your profile URL in{" "}
              <code className="font-mono text-primary/80">src/components/CTA.tsx</code>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
