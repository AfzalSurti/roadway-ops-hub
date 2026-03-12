import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { AppNotification, TaskItem } from "@/lib/domain";
import { toast } from "sonner";

export function TopBar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [comment, setComment] = useState("");
  const [isActing, setIsActing] = useState(false);
  const { data: notifications = [], refetch } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => api.getNotifications(20),
    enabled: Boolean(user)
  });
  const selectedTaskId = selectedNotification?.entityType === "Task" ? selectedNotification.entityId : "";
  const { data: selectedTask } = useQuery<TaskItem>({
    queryKey: ["task", "notification", selectedTaskId],
    queryFn: () => api.getTask(selectedTaskId),
    enabled: Boolean(selectedTaskId)
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

  const openDetails = async (item: AppNotification) => {
    setSelectedNotification(item);
    setComment("");
    if (!item.isRead) {
      await markOneRead(item.id);
    }
  };

  const handleApprove = async () => {
    if (!selectedTask) return;
    setIsActing(true);
    try {
      await api.approveTask(selectedTask.id);
      toast.success("Task approved successfully");
      await Promise.all([refetch()]);
      setSelectedNotification(null);
    } catch {
      toast.error("Failed to approve task");
    } finally {
      setIsActing(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedTask) return;
    const trimmed = comment.trim();
    if (!trimmed) {
      toast.error("Please enter a comment");
      return;
    }
    setIsActing(true);
    try {
      await api.requestTaskChanges(selectedTask.id, trimmed);
      toast.success("Comment added and changes requested");
      await Promise.all([refetch()]);
      setSelectedNotification(null);
    } catch {
      toast.error("Failed to request changes");
    } finally {
      setIsActing(false);
    }
  };

  const canReviewFromNotification =
    user?.role === "ADMIN" &&
    selectedTask?.status === "IN_PROGRESS" &&
    selectedNotification?.entityType === "Task";

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
                  onClick={() => void openDetails(item)}
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
        {selectedNotification && (
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-border/50 bg-background shadow-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-base font-semibold">{selectedNotification.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(selectedNotification.createdAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => setSelectedNotification(null)}
                  className="text-xs px-2 py-1 rounded-md bg-secondary/60 hover:bg-secondary"
                >
                  Close
                </button>
              </div>

              <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 mb-4">
                <p className="text-xs text-muted-foreground">Notification Summary</p>
                <p className="text-sm mt-1 leading-6">{selectedNotification.message}</p>
              </div>

              {selectedTask && (
                <div className="rounded-xl border border-border/40 p-4 space-y-2 mb-4">
                  <p className="text-sm font-semibold">Task Details</p>
                  <p className="text-sm"><span className="text-muted-foreground">Employee:</span> {selectedTask.assignedTo?.name ?? "-"}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Project:</span> {selectedTask.project}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Task:</span> {selectedTask.title}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Assigned Date:</span> {new Date(selectedTask.allocatedAt ?? selectedTask.createdAt).toLocaleString()}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Submitted Date:</span> {selectedTask.submittedForReviewAt ? new Date(selectedTask.submittedForReviewAt).toLocaleString() : "-"}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Due Date:</span> {new Date(selectedTask.dueDate).toLocaleString()}</p>
                  <p className="text-sm"><span className="text-muted-foreground">Status:</span> {selectedTask.status}</p>
                </div>
              )}

              {canReviewFromNotification && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                  <p className="text-sm font-semibold">Review Actions</p>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Add comment for employee..."
                    className="w-full rounded-xl border border-border/50 bg-secondary/30 px-3 py-2 text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => void handleApprove()}
                      disabled={isActing}
                      className="px-3 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 disabled:opacity-60"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => void handleRequestChanges()}
                      disabled={isActing}
                      className="px-3 py-2 rounded-lg bg-warning/20 text-warning text-sm font-medium hover:bg-warning/30 disabled:opacity-60"
                    >
                      Add Comment
                    </button>
                  </div>
                </div>
              )}
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
