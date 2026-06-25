import { Layers } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-10 px-5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Layers className="h-4 w-4 text-primary" />
          <span>OpsForge Showcase — Portfolio demonstration site</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Generic product preview · No client data · Built for freelance portfolio
        </p>
      </div>
    </footer>
  );
}
