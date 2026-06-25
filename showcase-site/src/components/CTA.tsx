import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Mail, Send } from "lucide-react";

type FormState = {
  name: string;
  email: string;
  phone: string;
  message: string;
};

const initialForm: FormState = {
  name: "",
  email: "",
  phone: "",
  message: ""
};

export function CTA() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const validate = () => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      next.name = "Please enter your full name";
    }
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = "Please enter a valid email address";
    }
    if (!form.message.trim() || form.message.trim().length < 10) {
      next.message = "Tell me about your project (at least 10 characters)";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setStatus("loading");
    setStatusMessage("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || undefined,
          message: form.message.trim()
        })
      });

      const data = (await response.json()) as { success?: boolean; message?: string };

      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Failed to send message");
      }

      setStatus("success");
      setStatusMessage("Thanks! Your message was sent — I'll get back to you soon.");
      setForm(initialForm);
      setErrors({});
    } catch (error) {
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <section id="contact" className="section-pad">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-8 sm:p-12"
        >
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-4">
                <Mail className="h-3.5 w-3.5" />
                Get in touch
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Want a platform like this?</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                I&apos;ve designed, built, and deployed this full-stack system end-to-end — DPR workflows, financial
                billing, asset management, expense tracking, and executive dashboards. Share your idea and
                let&apos;s discuss how I can help your team.
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Custom enterprise web applications
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Role-based dashboards &amp; PDF automation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  Full deployment &amp; production setup
                </li>
              </ul>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="glass p-6 space-y-4" noValidate>
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium mb-1.5">
                  Your name <span className="text-red-400">*</span>
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Rahul Sharma"
                  className={`w-full px-4 py-2.5 rounded-xl bg-background/60 border text-sm outline-none focus:border-primary/50 transition-colors ${
                    errors.name ? "border-red-500/50" : "border-border/60"
                  }`}
                />
                {errors.name ? <p className="text-xs text-red-400 mt-1">{errors.name}</p> : null}
              </div>

              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium mb-1.5">
                  Email address <span className="text-red-400">*</span>
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="you@company.com"
                  className={`w-full px-4 py-2.5 rounded-xl bg-background/60 border text-sm outline-none focus:border-primary/50 transition-colors ${
                    errors.email ? "border-red-500/50" : "border-border/60"
                  }`}
                />
                {errors.email ? <p className="text-xs text-red-400 mt-1">{errors.email}</p> : null}
              </div>

              <div>
                <label htmlFor="contact-phone" className="block text-sm font-medium mb-1.5">
                  Phone number <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  id="contact-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                  className="w-full px-4 py-2.5 rounded-xl bg-background/60 border border-border/60 text-sm outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium mb-1.5">
                  What are you looking to build? <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="contact-message"
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Describe your project — e.g. task management for a construction team, expense tracker, asset portal, or a full ops platform like this one..."
                  className={`w-full px-4 py-2.5 rounded-xl bg-background/60 border text-sm outline-none focus:border-primary/50 transition-colors resize-none ${
                    errors.message ? "border-red-500/50" : "border-border/60"
                  }`}
                />
                {errors.message ? <p className="text-xs text-red-400 mt-1">{errors.message}</p> : null}
              </div>

              {statusMessage ? (
                <p
                  className={`text-sm ${status === "success" ? "text-accent" : status === "error" ? "text-red-400" : "text-muted-foreground"}`}
                >
                  {statusMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send message
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
