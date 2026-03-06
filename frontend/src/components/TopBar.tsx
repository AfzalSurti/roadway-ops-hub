import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export function TopBar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.getNotifications(20),
    enabled: Boolean(user)
  });

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  const markAllRead = async () => {
    await api.markAllNotificationsRead();
    await refetch();
  };

  const markOneRead = async (id: string) => {
    await api.markNotificationRead(id);
    await refetch();
  };

  return (
    <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-30 flex items-center justify-between px-6">
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
        <button
          aria-label="Notifications"
          title="Notifications"
          onClick={() => setOpen((prev) => !prev)}
          className="relative p-2 rounded-xl hover:bg-secondary/50 transition-colors text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />}
        </button>
        {open && (
          <div className="absolute right-6 top-14 z-50 w-[360px] rounded-xl border border-border/50 bg-background shadow-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Notifications</p>
              <button onClick={() => void markAllRead()} className="text-xs text-primary hover:underline">
                Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  onClick={() => void markOneRead(item.id)}
                  className={`w-full text-left rounded-lg border p-2 transition-colors ${
                    item.isRead ? "border-border/30 bg-secondary/20" : "border-primary/30 bg-primary/5"
                  }`}
                >
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                </button>
              ))}
              {notifications.length === 0 && <p className="text-xs text-muted-foreground">No notifications yet.</p>}
            </div>
          </div>
        )}
        {user && (
          <div className="flex items-center gap-3">
            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
          </div>
        )}
      </div>
    </header>
  );
}
