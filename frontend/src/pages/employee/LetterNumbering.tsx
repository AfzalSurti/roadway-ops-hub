import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
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

export default function EmployeeLetterNumbering() {
  const queryClient = useQueryClient();

  const { data: pendingReplies = [], isLoading } = useQuery({
    queryKey: ["letter-my-pending-replies"],
    queryFn: () => api.getMyLetterPendingReplies()
  });

  const markRepliedMutation = useMutation({
    mutationFn: (letterId: string) => api.markMyLetterReply(letterId, true),
    onSuccess: async () => {
      toast.success("Marked replied");
      await queryClient.invalidateQueries({ queryKey: ["letter-my-pending-replies"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update")
  });

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Letter Numbering</h1>
          <p className="page-subtitle">Letters referred to you — mark replied once you've responded.</p>
        </div>
        {pendingReplies.length > 0 ? (
          <Badge variant="secondary" className="rounded-full gap-1 self-start">
            <MailWarning className="h-3.5 w-3.5" />
            {pendingReplies.length} pending reply
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
            Letters referred to you that are marked Need reply = Yes.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading pending letters...
          </p>
        ) : pendingReplies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No letters pending reply.</p>
        ) : (
          <div className="space-y-2">
            {pendingReplies.map((letter) => (
              <div
                key={letter.id}
                className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {letter.letterProject.projectNumber} · {letter.letterProject.shortName}
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      #{letter.serialLabel} {letter.category}
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
                <Button
                  size="sm"
                  className="gap-1 shrink-0"
                  disabled={markRepliedMutation.isPending}
                  onClick={() => markRepliedMutation.mutate(letter.id)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Mark replied
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
