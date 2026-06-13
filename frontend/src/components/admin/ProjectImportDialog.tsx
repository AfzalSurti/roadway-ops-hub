import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  downloadProjectImportTemplate,
  readProjectImportFile,
  type ProjectImportParseIssue,
  type ParsedProjectImportRow
} from "@/lib/project-import";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ImportResultState = {
  createdCount: number;
  failedCount: number;
  created: Array<{ excelRow: number; projectNumber: string; action: "created" | "updated" }>;
  errors: Array<{ excelRow: number; message: string }>;
};

type ProjectImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectImportDialog({ open, onOpenChange }: ProjectImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedProjectImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<ProjectImportParseIssue[]>([]);
  const [importResult, setImportResult] = useState<ImportResultState | null>(null);
  const [fileName, setFileName] = useState("");

  const resetState = () => {
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setFileName("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetState();
    }
    onOpenChange(next);
  };

  const importMutation = useMutation({
    mutationFn: () => api.bulkImportProjects(parsedRows.map((row) => row.payload)),
    onSuccess: async (result) => {
      const excelRowByIndex = new Map(parsedRows.map((row, index) => [index + 1, row.excelRow]));
      setImportResult({
        createdCount: result.createdCount,
        failedCount: result.failedCount + parseErrors.length,
        created: result.created.map((item) => ({
          excelRow: excelRowByIndex.get(item.row) ?? item.row,
          projectNumber: item.projectNumber,
          action: item.action
        })),
        errors: [
          ...parseErrors,
          ...result.errors.map((item) => ({
            excelRow: excelRowByIndex.get(item.row) ?? item.row,
            message: item.message
          }))
        ]
      });
      setParsedRows([]);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["project-requisition-forms"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "projects-summary"] })
      ]);
      if (result.createdCount > 0) {
        const created = result.created.filter((item) => item.action === "created").length;
        const updated = result.created.filter((item) => item.action === "updated").length;
        const parts = [];
        if (created) parts.push(`${created} created`);
        if (updated) parts.push(`${updated} updated`);
        toast.success(`Project import complete: ${parts.join(", ")}`);
      }
      if (result.failedCount > 0 || parseErrors.length > 0) {
        toast.error("Some rows could not be imported. See details below.");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Import failed")
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportResult(null);
    setFileName(file.name);

    try {
      const parsed = await readProjectImportFile(file);
      setParsedRows(parsed.rows);
      setParseErrors(parsed.parseErrors);

      if (parsed.rows.length === 0 && parsed.parseErrors.length === 0) {
        toast.error("No project rows found in the Excel file");
      } else if (parsed.rows.length === 0) {
        toast.error("All rows have errors. Fix the Excel file and try again.");
      } else if (parsed.parseErrors.length > 0) {
        toast.warning(`${parsed.rows.length} row(s) ready to import, ${parsed.parseErrors.length} row(s) skipped`);
      } else {
        toast.success(`${parsed.rows.length} row(s) ready to import`);
      }
    } catch {
      toast.error("Could not read the Excel file");
      setParsedRows([]);
      setParseErrors([{ excelRow: 0, message: "Invalid or corrupted Excel file" }]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Projects & Requisition Forms</DialogTitle>
          <DialogDescription>
            Download the template, fill project and requisition details, then upload. Each valid row creates or updates
            the project and its requisition form. Rows with missing fields are skipped with an error message.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="outline" className="w-full gap-2" onClick={() => downloadProjectImportTemplate()}>
            <Download className="h-4 w-4" />
            Download Excel Template
          </Button>

          <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
            <Button type="button" variant="secondary" className="gap-2" onClick={() => fileInputRef.current?.click()}>
              <FileUp className="h-4 w-4" />
              Choose Excel File
            </Button>
            {fileName ? <p className="text-xs text-muted-foreground mt-2">{fileName}</p> : null}
          </div>

          {parsedRows.length > 0 && !importResult ? (
            <p className="text-sm text-muted-foreground">
              {parsedRows.length} project row(s) ready to import
              {parseErrors.length > 0 ? ` (${parseErrors.length} row(s) skipped due to missing/invalid fields)` : ""}.
            </p>
          ) : null}

          {importResult ? (
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-2 max-h-56 overflow-y-auto text-sm">
              <p>
                <span className="font-medium text-emerald-600">{importResult.createdCount} imported</span>
                {" · "}
                <span className="font-medium text-destructive">{importResult.failedCount} failed</span>
              </p>
              {importResult.created.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Imported</p>
                  <ul className="space-y-1">
                    {importResult.created.map((item) => (
                      <li key={`${item.excelRow}-${item.projectNumber}`}>
                        Row {item.excelRow}: {item.projectNumber} ({item.action === "created" ? "new project" : "updated"})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importResult.errors.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Errors</p>
                  <ul className="space-y-1 text-destructive">
                    {importResult.errors.map((item) => (
                      <li key={`${item.excelRow}-${item.message}`}>
                        Row {item.excelRow}: {item.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : parseErrors.length > 0 && !importResult ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 max-h-40 overflow-y-auto text-sm">
              <p className="font-medium text-destructive mb-2">Rows with errors (will be skipped)</p>
              <ul className="space-y-1 text-destructive">
                {parseErrors.map((item) => (
                  <li key={`${item.excelRow}-${item.message}`}>
                    Row {item.excelRow}: {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          {!importResult ? (
            <Button
              type="button"
              disabled={parsedRows.length === 0 || importMutation.isPending}
              onClick={() => importMutation.mutate()}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                `Import ${parsedRows.length} Project(s)`
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
