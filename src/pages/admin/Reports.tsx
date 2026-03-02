import { useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { reports, tasks, users, reportTypeLabels } from "@/lib/mock-data";
import { FileCheck, Eye, CheckCircle, XCircle, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type ReportStatusFilter = "all" | "pending" | "approved" | "changes_requested" | "rejected";

export default function AdminReports() {
  const [filter, setFilter] = useState<ReportStatusFilter>("all");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  const [feedbackModal, setFeedbackModal] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const selected = reports.find((r) => r.id === selectedReport);

  const statusFilters: { value: ReportStatusFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "changes_requested", label: "Changes Requested" },
    { value: "rejected", label: "Rejected" },
  ];

  const handleApprove = (id: string) => { toast.success("Report approved"); };
  const handleReject = (id: string) => { toast.error("Report rejected"); };
  const handleRequestChanges = () => {
    toast("Changes requested", { description: feedback });
    setFeedbackModal(null);
    setFeedback("");
  };

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Review and approve submitted reports</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all",
              filter === f.value ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary/50 text-muted-foreground border border-border/50 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 glass-panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left p-4 font-medium">Task</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Submitted By</th>
                <th className="text-left p-4 font-medium hidden md:table-cell">Date</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-left p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => {
                const task = tasks.find((t) => t.id === report.taskId);
                const submitter = users.find((u) => u.id === report.submittedBy);
                return (
                  <tr
                    key={report.id}
                    onClick={() => setSelectedReport(report.id)}
                    className={cn("border-b border-border/30 hover:bg-secondary/30 transition-colors cursor-pointer", selectedReport === report.id && "bg-secondary/30")}
                  >
                    <td className="p-4">
                      <p className="font-medium">{task?.title}</p>
                      <p className="text-xs text-muted-foreground">{reportTypeLabels[task?.reportType || "road_inspection"]}</p>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <div className="flex items-center gap-2">
                        <img src={submitter?.avatar} alt="" className="w-6 h-6 rounded-full" />
                        <span className="text-muted-foreground">{submitter?.name}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell text-muted-foreground">
                      {new Date(report.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className={cn("status-badge",
                        report.status === "pending" && "text-warning bg-warning/10",
                        report.status === "approved" && "text-accent bg-accent/10",
                        report.status === "changes_requested" && "text-primary bg-primary/10",
                        report.status === "rejected" && "text-destructive bg-destructive/10",
                      )}>
                        {report.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); handleApprove(report.id); }} className="p-1.5 rounded-lg hover:bg-accent/10 text-accent transition-colors"><CheckCircle className="h-4 w-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); setFeedbackModal(report.id); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"><MessageSquare className="h-4 w-4" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleReject(report.id); }} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"><XCircle className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Preview Panel */}
        <div className="glass-panel p-6">
          {selected ? (
            <div>
              <h3 className="font-semibold mb-4">Report Preview</h3>
              <div className="space-y-3">
                {Object.entries(selected.fields).map(([key, value]) => (
                  <div key={key}>
                    <p className="text-xs text-muted-foreground">{key}</p>
                    <p className="text-sm font-medium">{value}</p>
                  </div>
                ))}
              </div>
              {selected.attachments.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Attachments</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.attachments.map((a, i) => (
                      <span key={i} className="text-xs px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-muted-foreground">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {selected.feedback && (
                <div className="mt-4 p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-xs text-warning mb-1">Feedback</p>
                  <p className="text-sm">{selected.feedback}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Eye className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Select a report to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Modal */}
      {feedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Request Changes</h3>
              <button onClick={() => setFeedbackModal(null)} className="p-1 rounded-lg hover:bg-secondary/50"><X className="h-4 w-4" /></button>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none mb-4 focus:border-primary/50"
              placeholder="Describe what changes are needed…"
            />
            <button onClick={handleRequestChanges} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity">
              Send Feedback
            </button>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}
