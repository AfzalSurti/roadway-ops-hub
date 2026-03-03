import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function TopBar() {
  const { user } = useAuth();

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-6">
      <div className="hidden md:flex items-center gap-2 mr-4">
        <img src="/roadway-logo.svg" alt="RoadwayOps" className="h-7 w-7 rounded-md" />
        <span className="text-sm font-semibold tracking-wide">RoadwayOps Hub</span>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="flex items-center gap-2 w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-muted-foreground text-sm">
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline">Search tasks, reports…</span>
          <kbd className="ml-auto hidden sm:inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-xl hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>
        {user && (
          <div className="flex items-center gap-3">
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
          </div>
        )}
      </div>
    </header>
  );
}
