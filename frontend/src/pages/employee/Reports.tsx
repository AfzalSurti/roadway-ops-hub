import { PageWrapper } from "@/components/PageWrapper";
import { FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { reportStatusConfig } from "@/lib/domain";

export default function EmployeeReports() {
  const { data } = useQuery({ queryKey: ["reports", "employee"], queryFn: () => api.getReports({ limit: 100 }) });
  const myReports = data?.items ?? [];

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">My Reports</h1>
        <p className="page-subtitle">Track your submitted reports</p>
      </div>

      {myReports.length > 0 ? (
        <div className="space-y-3">
          {myReports.map((report, index) => (
            <motion.div
              key={report.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-panel p-4"
            >
              <div className="flex items-center gap-4">
                <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
                  <FileCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{report.task?.title ?? report.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {report.reportTemplate?.name ?? "Template"} · Submitted {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={cn("status-badge shrink-0", reportStatusConfig[report.status].color)}>
                  {reportStatusConfig[report.status].label}
                </span>
              </div>
              {report.adminFeedback && (
                <div className="mt-3 ml-14 p-3 rounded-xl bg-warning/5 border border-warning/20">
                  <p className="text-xs text-warning mb-1">Feedback</p>
                  <p className="text-sm">{report.adminFeedback}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-12 text-center text-muted-foreground">
          <FileCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No reports submitted yet.</p>
        </div>
      )}
    </PageWrapper>
  );
}