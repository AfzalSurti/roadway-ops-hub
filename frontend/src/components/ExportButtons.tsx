import { Button } from "@/components/ui/button";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  disabled?: boolean;
  onExcel: () => void | Promise<void>;
  onPdf: () => void | Promise<void>;
  size?: "sm" | "default";
};

/** Excel + PDF download buttons for filtered table exports. */
export function ExportButtons({ disabled, onExcel, onPdf, size = "sm" }: Props) {
  const [busy, setBusy] = useState<"excel" | "pdf" | null>(null);

  const run = async (kind: "excel" | "pdf", fn: () => void | Promise<void>) => {
    setBusy(kind);
    try {
      await fn();
      toast.success(kind === "excel" ? "Excel downloaded" : "PDF downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        type="button"
        size={size}
        variant="outline"
        className="gap-1"
        disabled={disabled || busy !== null}
        onClick={() => void run("excel", onExcel)}
        title="Download Excel of filtered rows"
      >
        {busy === "excel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSpreadsheet className="h-3.5 w-3.5" />}
        Excel
      </Button>
      <Button
        type="button"
        size={size}
        variant="outline"
        className="gap-1"
        disabled={disabled || busy !== null}
        onClick={() => void run("pdf", onPdf)}
        title="Download PDF of filtered rows"
      >
        {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        PDF
      </Button>
      <span className="sr-only">
        <Download className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}
