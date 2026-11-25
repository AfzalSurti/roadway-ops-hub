import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  downloadSubStaffImportTemplate,
  readSubStaffImportFile,
  type ParsedSubStaffImportRow,
  type SubStaffImportParseIssue
} from "@/lib/sub-staff-import";
import {
  SubStaffFormFields,
  subStaffFormToPayload,
  applySubStaffDefaults,
  type ProjectOption,
  type SubStaffFormState
} from "@/components/substaff/SubStaffFormFields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ChevronDown, ChevronUp, Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ImportResultState = {
  createdCount: number;
  failedCount: number;
  errors: Array<{ excelRow: number; message: string }>;
};

export function SubStaffImportDialog({
  open,
  onOpenChange,
  designationOptions,
  staffNameOptions,
  projectOptions
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designationOptions: string[];
  staffNameOptions: string[];
  projectOptions: ProjectOption[];
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSubStaffImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<SubStaffImportParseIssue[]>([]);
  const [importResult, setImportResult] = useState<ImportResultState | null>(null);
  const [fileName, setFileName] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const resetState = () => {
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setFileName("");
    setExpandedIndex(null);
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
    setExpandedIndex(null);
    setFileName(file?.name ?? "");
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const { rows, errors } = readSubStaffImportFile(buffer);
      setParsedRows(rows);
      setParseErrors(errors);
      const flaggedCount = rows.filter((r) => r.issues.length > 0).length;
      if (rows.length === 0 && errors.length === 0) {
        toast.error("No data rows found in the Excel file");
      } else if (rows.length === 0) {
        toast.error("No valid rows to import — fix the errors listed below");
      } else if (flaggedCount > 0 || errors.length > 0) {
        toast.message(
          `${rows.length} row(s) parsed — ${flaggedCount} flagged for review${
            errors.length > 0 ? `, ${errors.length} skipped` : ""
          }`
        );
      } else {
        toast.success(`${rows.length} row(s) ready to import`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read Excel file");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import staff from Excel</DialogTitle>
          <DialogDescription>
            Matches your existing staff register columns (Staff Name, Designation, Client, Rate, periods,
            man-months). Balance MM and suggested Days Per Month calculate automatically. Download the
            sample for the correct columns. A row with a missing/unreadable cell still imports (left blank
            or defaulted) but is flagged below for review — open it and fix the value before importing. A
            row missing Staff Name entirely can't be imported and is listed separately.
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

          {!importResult && parsedRows.some((r) => r.issues.length > 0) ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 inline-flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                {parsedRows.filter((r) => r.issues.length > 0).length} row(s) flagged for review — they'll still
                import, but check these
              </p>
              <div className="max-h-72 overflow-auto space-y-1.5">
                {parsedRows.map((row, index) => {
                  if (row.issues.length === 0) return null;
                  const isOpen = expandedIndex === index;
                  return (
                    <div key={row.excelRow} className="rounded-lg border border-border/40 bg-background/60">
                      <button
                        type="button"
                        className="w-full flex items-center justify-between gap-2 p-2 text-left text-xs"
                        onClick={() => setExpandedIndex(isOpen ? null : index)}
                      >
                        <span>
                          Excel row {row.excelRow} — <span className="font-medium">{row.form.staffName}</span>{" "}
                          <Badge variant="outline" className="ml-1">
                            {row.issues.length} issue{row.issues.length > 1 ? "s" : ""}
                          </Badge>
                        </span>
                        {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                      <ul className="px-3 pb-2 space-y-0.5 text-xs text-muted-foreground">
                        {row.issues.map((msg) => (
                          <li key={msg}>• {msg}</li>
                        ))}
                      </ul>
                      {isOpen ? (
                        <div className="border-t border-border/30 p-3 space-y-3">
                          <SubStaffFormFields
                            value={row.form}
                            onChange={(patch: Partial<SubStaffFormState>) => {
                              const changedKey = Object.keys(patch)[0] as keyof SubStaffFormState;
                              setParsedRows((prev) =>
                                prev.map((r, i) =>
                                  i === index
                                    ? { ...r, form: applySubStaffDefaults({ ...r.form, ...patch }, changedKey) }
                                    : r
                                )
                              );
                            }}
                            designationOptions={designationOptions}
                            staffNameOptions={staffNameOptions}
                            projectOptions={projectOptions}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setParsedRows((prev) => prev.map((r, i) => (i === index ? { ...r, issues: [] } : r)));
                              setExpandedIndex(null);
                            }}
                          >
                            Mark reviewed
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
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
