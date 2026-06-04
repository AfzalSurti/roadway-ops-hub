import { Badge } from "@/components/ui/badge";
import { expenseSheetStatusConfig, type ExpenseSheetStatus } from "@/lib/domain";

export function ExpenseStatusBadge({ status }: { status: ExpenseSheetStatus }) {
  const config = expenseSheetStatusConfig[status];
  return (
    <Badge variant="secondary" className={`rounded-full ${config.className}`}>
      {config.label}
    </Badge>
  );
}
