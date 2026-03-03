import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, ClipboardCheck, FolderKanban, ShieldCheck } from "lucide-react";

const highlights = [
  {
    title: "Project-Centric Operations",
    description: "Track highway projects with task status, assignees, and delivery progress in one place.",
    icon: FolderKanban
  },
  {
    title: "Structured Field Reporting",
    description: "Use report templates for clear site updates, numeric measurements, and submission workflows.",
    icon: ClipboardCheck
  },
  {
    title: "Secure Role-Based Access",
    description: "Separate admin and employee access with JWT authentication and protected workflows.",
    icon: ShieldCheck
  }
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/roadway-logo.svg" alt="RoadwayOps" className="h-9 w-9 rounded-lg" />
            <div>
              <p className="text-lg font-semibold leading-none">HighwayOps</p>
              <p className="text-xs text-muted-foreground mt-1">Task & Report Management</p>
            </div>
          </div>

          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Sign In
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 md:py-14 space-y-14">
        <section className="grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 mb-5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Built for Highway Operations Teams
            </p>

            <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
              Manage Projects, Tasks, and Field Reports with Clarity
            </h1>

            <p className="text-muted-foreground mt-5 text-base md:text-lg leading-relaxed max-w-xl">
              HighwayOps centralizes admin planning and employee reporting into one workflow,
              so your team can execute faster and monitor progress in real time.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Continue to Platform
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="glass-panel p-3 md:p-4">
            <img src="/landing-hero.svg" alt="HighwayOps platform preview" className="w-full rounded-xl border border-border/40" />
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-4">
          {highlights.map((item) => (
            <div key={item.title} className="glass-panel p-5">
              <div className="p-2.5 rounded-xl bg-primary/10 w-fit mb-4">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{item.description}</p>
            </div>
          ))}
        </section>

        <section className="grid lg:grid-cols-2 gap-6">
          <div className="glass-panel p-4">
            <p className="text-sm font-medium mb-3">Task & Team Workload</p>
            <img src="/landing-feature-1.svg" alt="Task management preview" className="w-full rounded-xl border border-border/40" />
          </div>
          <div className="glass-panel p-4">
            <p className="text-sm font-medium mb-3">Reports & Submission Workflow</p>
            <img src="/landing-feature-2.svg" alt="Report workflow preview" className="w-full rounded-xl border border-border/40" />
          </div>
        </section>
      </main>
    </div>
  );
};

export default Index;
