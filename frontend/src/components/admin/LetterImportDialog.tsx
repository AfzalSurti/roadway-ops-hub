import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  downloadLetterImportTemplate,
  readLetterImportFile,
  type LetterImportParseIssue,
  type ParsedLetterImportRow,
} from "@/lib/letter-import";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ImportResultState = {
  createdCount: number;
  failedCount: number;
  created: Array<{ excelRow: number; serialLabel: string; letterNumber: string; category: string }>;
  errors: Array<{ excelRow: number; message: string }>;
};

type LetterImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  letterProjectId: string;
  projectLabel?: string;
};

export function LetterImportDialog({
  open,
  onOpenChange,
  letterProjectId,
  projectLabel,
}: LetterImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedLetterImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<LetterImportParseIssue[]>([]);
  const [importResult, setImportResult] = useState<ImportResultState | null>(null);
  const [fileName, setFileName] = useState("");

  const resetState = () => {
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetState();
    onOpenChange(next);
  };

  const importMutation = useMutation({
    mutationFn: () => api.bulkImportLetterEntries(
      letterProjectId,
      parsedRows.map((row) => row.payload)
    ),
    onSuccess: async (result) => {
      const excelRowByIndex = new Map(parsedRows.map((row, index) => [index + 1, row.excelRow]));
      setImportResult({
        createdCount: result.createdCount,
        failedCount: result.failedCount + parseErrors.length,
        created: result.created.map((item) => ({
          excelRow: excelRowByIndex.get(item.row) ?? item.row,
          serialLabel: item.serialLabel,
          letterNumber: item.letterNumber,
          category: item.category,
        })),
        errors: [
          ...parseErrors,
          ...result.errors.map((item) => ({
            excelRow: excelRowByIndex.get(item.row) ?? item.row,
            message: item.message,
          })),
        ].sort((a, b) => a.excelRow - b.excelRow),
      });
      setParsedRows([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["letter-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["letter-project", letterProjectId] }),
        queryClient.invalidateQueries({ queryKey: ["letter-pending-replies"] }),
      ]);
      if (result.createdCount > 0) {
        toast.success(`${result.createdCount} letter(s) imported`);
      }
      if (result.failedCount + parseErrors.length > 0) {
        toast.error(`${result.failedCount + parseErrors.length} row(s) could not be imported`);
      }
    },
    onError: (error: Error) => toast.error(error.message || "Import failed"),
  });

  const onFileChange = async (file: File | null) => {
    setImportResult(null);
    setParsedRows([]);
    setParseErrors([]);
    setFileName(file?.name ?? "");
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const { rows, errors } = readLetterImportFile(buffer);
      setParsedRows(rows);
      setParseErrors(errors);
      if (rows.length === 0 && errors.length === 0) {
        toast.error("No data rows found in the Excel file");
      } else if (rows.length === 0) {
        toast.error("No valid rows to import — fix the errors listed below");
      } else if (errors.length > 0) {
        toast.message(`${rows.length} valid row(s), ${errors.length} row(s) with problems`);
      } else {
        toast.success(`${rows.length} row(s) ready to import`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read Excel file");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import letters from Excel</DialogTitle>
          <DialogDescription>
            Bulk-add letters for {projectLabel || "this project"}. Download the sample file for the
            correct columns. Valid rows are saved; problem rows are skipped and listed with reasons.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => downloadLetterImportTemplate()}
            >
              <Download className="h-3.5 w-3.5" />
              Download sample Excel
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5" />
              Choose Excel file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
            />
          </div>

          {fileName ? (
            <p className="text-xs text-muted-foreground">
              Selected: <span className="font-medium text-foreground">{fileName}</span>
              {parsedRows.length > 0 ? ` · ${parsedRows.length} valid row(s)` : null}
              {parseErrors.length > 0 ? ` · ${parseErrors.length} parse error(s)` : null}
            </p>
          ) : null}

          {parseErrors.length > 0 && !importResult ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-destructive">Rows not ready to import</p>
              <ul className="max-h-40 overflow-auto space-y-1 text-xs">
                {parseErrors.map((issue) => (
                  <li key={`${issue.excelRow}-${issue.message}`}>
                    Row {issue.excelRow}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {importResult ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/40 bg-secondary/20 p-3 text-xs">
                Imported <strong>{importResult.createdCount}</strong> · Failed / skipped{" "}
                <strong>{importResult.failedCount}</strong>
              </div>
              {importResult.created.length > 0 ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Imported</p>
                  <ul className="max-h-32 overflow-auto space-y-1 text-xs">
                    {importResult.created.map((item) => (
                      <li key={`${item.excelRow}-${item.serialLabel}-${item.letterNumber}`}>
                        Excel row {item.excelRow}: #{item.serialLabel} · {item.letterNumber} ({item.category})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importResult.errors.length > 0 ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-destructive">Not entered</p>
                  <ul className="max-h-40 overflow-auto space-y-1 text-xs">
                    {importResult.errors.map((issue) => (
                      <li key={`${issue.excelRow}-${issue.message}`}>
                        Excel row {issue.excelRow}: {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            disabled={parsedRows.length === 0 || importMutation.isPending}
            onClick={() => importMutation.mutate()}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" /> Importing…
              </>
            ) : (
              `Import ${parsedRows.length || ""} letter(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
