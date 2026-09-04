import { useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { LetterActionType } from "@/lib/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";

function calendarParts(value?: string | null): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function toDateInput(value?: string | null) {
  const parts = calendarParts(value);
  if (!parts) return "";
  return `${String(parts.d).padStart(2, "0")}/${String(parts.m).padStart(2, "0")}/${parts.y}`;
}

function actionTypeLabel(actionType?: LetterActionType | null) {
  if (actionType === "FOLLOW_UP") return "Follow Up";
  if (actionType === "REPLY") return "Reply";
  return "-";
}

export default function EmployeeLetterNumbering() {
  const queryClient = useQueryClient();
  const [remarks, setRemarks] = useState<Record<string, string>>({});

  const { data: pendingReplies = [], isLoading } = useQuery({
    queryKey: ["letter-my-pending-replies"],
    queryFn: () => api.getMyLetterPendingReplies()
  });

  const submitMutation = useMutation({
    mutationFn: ({ letterId, remark }: { letterId: string; remark: string }) =>
      api.submitMyLetterAction(letterId, remark),
    onSuccess: async (_data, variables) => {
      toast.success("Submitted — sent to admin for review");
      setRemarks((prev) => {
        const next = { ...prev };
        delete next[variables.letterId];
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["letter-my-pending-replies"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to submit")
  });

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Letter Numbering</h1>
          <p className="page-subtitle">Letters referred to you — complete the action and submit a remark.</p>
        </div>
        {pendingReplies.length > 0 ? (
          <Badge variant="secondary" className="rounded-full gap-1 self-start">
            <MailWarning className="h-3.5 w-3.5" />
            {pendingReplies.length} pending
          </Badge>
        ) : null}
      </div>

      <div className="glass-panel p-5 space-y-4">
        <div>
          <h2 className="text-lg font-semibold inline-flex items-center gap-2">
            <MailWarning className="h-5 w-5 text-amber-500" />
            Reply Pending
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Letters referred to you. Add a remark and submit — it goes to admin for review.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pending letters...
          </p>
        ) : pendingReplies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No letters pending.</p>
        ) : (
          <div className="space-y-3">
            {pendingReplies.map((letter) => (
              <div key={letter.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {letter.letterProject.projectNumber} · {letter.letterProject.shortName}
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      #{letter.serialLabel} {letter.category}
                    </Badge>
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      {actionTypeLabel(letter.actionType)}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 whitespace-normal break-words">
                    {letter.letterDate ? toDateInput(letter.letterDate) : "No date"}
                    {" · From: "}
                    {letter.sentBy || "-"}
                    {" · "}
                    {letter.subject || "No subject"}
                  </p>
                </div>
                <textarea
                  value={remarks[letter.id] ?? letter.employeeRemark ?? ""}
                  onChange={(e) => setRemarks((prev) => ({ ...prev, [letter.id]: e.target.value }))}
                  placeholder="Add a remark before submitting…"
                  rows={2}
                  className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={
                      submitMutation.isPending || !(remarks[letter.id] ?? letter.employeeRemark ?? "").trim()
                    }
                    onClick={() =>
                      submitMutation.mutate({
                        letterId: letter.id,
                        remark: (remarks[letter.id] ?? letter.employeeRemark ?? "").trim()
                      })
                    }
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Submit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
