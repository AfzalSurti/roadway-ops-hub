import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { X, ListTodo, AlertTriangle, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toAvatarUrl } from "@/lib/domain";
import { toast } from "sonner";

export default function AdminTeam() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const { data: users = [], refetch: refetchUsers } = useQuery({ queryKey: ["users"], queryFn: () => api.getUsers() });
  const { data: tasksData } = useQuery({ queryKey: ["tasks", "team"], queryFn: () => api.getTasks({ limit: 200 }) });
  const { data: reportsData } = useQuery({ queryKey: ["reports", "team"], queryFn: () => api.getReports({ limit: 200 }) });

  const tasks = tasksData?.items ?? [];
  const reports = reportsData?.items ?? [];

  const selected = users.find((user) => user.id === selectedUser);
  const selectedTasks = tasks.filter((task) => task.assignedToId === selectedUser);
  const selectedReports = reports.filter((report) => report.submittedById === selectedUser);

  const workloadData = useMemo(
    () =>
      users.map((employee) => {
        const employeeTasks = tasks.filter((task) => task.assignedToId === employee.id);
        return {
          employee,
          active: employeeTasks.filter((task) => task.status !== "DONE").length,
          done: employeeTasks.filter((task) => task.status === "DONE").length,
          overdue: employeeTasks.filter((task) => new Date(task.dueDate) < new Date() && task.status !== "DONE").length
        };
      }),
    [tasks, users]
  );

  const handleCreateEmployee = async () => {
    try {
      await api.createEmployee(form);
      await refetchUsers();
      setShowCreate(false);
      setForm({ name: "", email: "", password: "" });
      toast.success("Employee created successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create employee";
      toast.error(message);
    }
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">Team</h1>
          <p className="page-subtitle">Monitor your team's workload and performance</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {workloadData.map((workload, index) => (
          <motion.div
            key={workload.employee.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedUser(workload.employee.id)}
            className="task-card cursor-pointer text-center"
          >
            <img src={toAvatarUrl(workload.employee.name)} alt={workload.employee.name} className="w-12 h-12 rounded-full mx-auto mb-3" />
            <p className="font-medium text-sm">{workload.employee.name}</p>
            <p className="text-xs text-muted-foreground mb-3">{workload.employee.email}</p>
            <div className="flex justify-center gap-4 text-xs">
              <span className="flex items-center gap-1 text-primary"><ListTodo className="h-3 w-3" />{workload.active}</span>
              {workload.overdue > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />{workload.overdue}</span>}
            </div>
          </motion.div>
        ))}
      </div>

      {selectedUser && selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Team Member Profile</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg hover:bg-secondary/50"><X className="h-4 w-4" /></button>
            </div>

            <div className="text-center mb-6">
              <img src={toAvatarUrl(selected.name)} alt="" className="w-16 h-16 rounded-full mx-auto mb-3" />
              <p className="font-semibold text-lg">{selected.name}</p>
              <p className="text-sm text-muted-foreground">{selected.email}</p>
            </div>

            <h4 className="font-medium mb-3">Tasks ({selectedTasks.length})</h4>
            <div className="space-y-2 mb-6">
              {selectedTasks.map((task) => (
                <div key={task.id} className="p-3 rounded-xl bg-secondary/30 border border-border/30">
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.project} · Due {new Date(task.dueDate).toLocaleDateString()}</p>
                </div>
              ))}
            </div>

            <h4 className="font-medium mb-3">Submissions ({selectedReports.length})</h4>
            <div className="space-y-2">
              {selectedReports.map((report) => (
                <div key={report.id} className="p-3 rounded-xl bg-secondary/30 border border-border/30">
                  <p className="text-sm font-medium">{report.task?.title ?? report.id}</p>
                  <p className="text-xs text-muted-foreground capitalize">{report.status.replace("_", " ")}</p>
                </div>
              ))}
              {selectedReports.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet</p>}
            </div>
          </motion.div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Add Employee</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-secondary/50">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                placeholder="Full name"
              />
              <input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                placeholder="Email"
                type="email"
              />
              <input
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                placeholder="Temporary password"
                type="password"
              />
              <button
                onClick={() => void handleCreateEmployee()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Create Employee
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}