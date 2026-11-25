import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  downloadSubStaffImportTemplate,
  readSubStaffImportFile,
  type ParsedSubStaffImportRow,
  type SubStaffImportParseIssue
} from "@/lib/sub-staff-import";
import { subStaffFormToPayload } from "@/components/substaff/SubStaffFormFields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ImportResultState = {
  createdCount: number;
  failedCount: number;
  errors: Array<{ excelRow: number; message: string }>;
};

export function SubStaffImportDialog({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSubStaffImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<SubStaffImportParseIssue[]>([]);
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
    mutationFn: () => api.importSubStaffAssignments(parsedRows.map((row) => subStaffFormToPayload(row.form))),
    onSuccess: async (result) => {
      const excelRowByIndex = new Map(parsedRows.map((row, index) => [index + 1, row.excelRow]));
      setImportResult({
        createdCount: result.createdCount,
        failedCount: result.failedCount + parseErrors.length,
        errors: [
          ...parseErrors,
          ...result.errors.map((item) => ({
            excelRow: excelRowByIndex.get(item.row) ?? item.row,
            message: item.message
          }))
        ].sort((a, b) => a.excelRow - b.excelRow)
      });
      setParsedRows([]);
      await queryClient.invalidateQueries({ queryKey: ["sub-staff-assignments"] });
      await queryClient.invalidateQueries({ queryKey: ["sub-staff-clashes"] });
      if (result.createdCount > 0) toast.success(`${result.createdCount} staff record(s) imported`);
      if (result.failedCount + parseErrors.length > 0) {
        toast.error(`${result.failedCount + parseErrors.length} row(s) could not be imported`);
      }
    },
    onError: (error: Error) => toast.error(error.message || "Import failed")
  });

  const onFileChange = async (file: File | null) => {
    setImportResult(null);
    setParsedRows([]);
    setParseErrors([]);
    setFileName(file?.name ?? "");
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const { rows, errors } = readSubStaffImportFile(buffer);
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
          <DialogTitle>Import staff from Excel</DialogTitle>
          <DialogDescription>
            Matches your existing staff register columns (Staff Name, Designation, Client, Rate, periods,
            man-months). Balance MM and suggested Days Per Month calculate automatically. Download the
            sample for the correct columns. Valid rows are saved; a problem row is skipped and its reason
            is shown, other rows still import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={() => downloadSubStaffImportTemplate()}
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
              `Import ${parsedRows.length || ""} record(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
