import { useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { users, tasks, reports } from "@/lib/mock-data";
import { X, ListTodo, AlertTriangle, FileCheck } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function AdminTeam() {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const employees = users.filter((u) => u.role === "employee");

  const workloadData = employees.map((emp) => {
    const empTasks = tasks.filter((t) => t.assignedTo === emp.id);
    return {
      name: emp.name.split(" ")[0],
      active: empTasks.filter((t) => t.status !== "done").length,
      done: empTasks.filter((t) => t.status === "done").length,
    };
  });

  const selected = users.find((u) => u.id === selectedUser);
  const selectedTasks = tasks.filter((t) => t.assignedTo === selectedUser);
  const selectedReports = reports.filter((r) => r.submittedBy === selectedUser);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Team</h1>
        <p className="page-subtitle">Monitor your team's workload and performance</p>
      </div>

      {/* Team Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {employees.map((emp, i) => {
          const empTasks = tasks.filter((t) => t.assignedTo === emp.id);
          const active = empTasks.filter((t) => t.status !== "done").length;
          const overdue = empTasks.filter((t) => new Date(t.dueDate) < new Date() && t.status !== "done").length;
          return (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedUser(emp.id)}
              className="task-card cursor-pointer text-center"
            >
              <img src={emp.avatar} alt={emp.name} className="w-12 h-12 rounded-full mx-auto mb-3" />
              <p className="font-medium text-sm">{emp.name}</p>
              <p className="text-xs text-muted-foreground mb-3">{emp.email}</p>
              <div className="flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1 text-primary"><ListTodo className="h-3 w-3" />{active}</span>
                {overdue > 0 && <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />{overdue}</span>}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Workload Chart */}
      <div className="glass-panel p-6 mb-8">
        <h3 className="font-semibold mb-4">Team Workload</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={workloadData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 16%)" />
            <XAxis dataKey="name" stroke="hsl(215, 15%, 55%)" fontSize={12} />
            <YAxis stroke="hsl(215, 15%, 55%)" fontSize={12} />
            <Tooltip contentStyle={{ background: "hsl(220, 16%, 10%)", border: "1px solid hsl(220, 14%, 16%)", borderRadius: "12px", color: "hsl(210, 20%, 92%)" }} />
            <Bar dataKey="active" name="Active" fill="hsl(185, 70%, 50%)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="done" name="Done" fill="hsl(160, 70%, 42%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Profile Drawer */}
      {selectedUser && selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={() => setSelectedUser(null)}>
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold">Team Member Profile</h3>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg hover:bg-secondary/50"><X className="h-4 w-4" /></button>
            </div>

            <div className="text-center mb-6">
              <img src={selected.avatar} alt="" className="w-16 h-16 rounded-full mx-auto mb-3" />
              <p className="font-semibold text-lg">{selected.name}</p>
              <p className="text-sm text-muted-foreground">{selected.email}</p>
            </div>

            <h4 className="font-medium mb-3">Tasks ({selectedTasks.length})</h4>
            <div className="space-y-2 mb-6">
              {selectedTasks.map((t) => (
                <div key={t.id} className="p-3 rounded-xl bg-secondary/30 border border-border/30">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.project} · Due {new Date(t.dueDate).toLocaleDateString()}</p>
                </div>
              ))}
            </div>

            <h4 className="font-medium mb-3">Submissions ({selectedReports.length})</h4>
            <div className="space-y-2">
              {selectedReports.map((r) => {
                const task = tasks.find((t) => t.id === r.taskId);
                return (
                  <div key={r.id} className="p-3 rounded-xl bg-secondary/30 border border-border/30">
                    <p className="text-sm font-medium">{task?.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.status.replace("_", " ")}</p>
                  </div>
                );
              })}
              {selectedReports.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet</p>}
            </div>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}
