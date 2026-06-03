import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  downloadAssetImportTemplate,
  readAssetImportFile,
  type AssetImportParseIssue,
  type ParsedAssetImportRow
} from "@/lib/asset-import";
import { findImportDuplicates } from "@/lib/asset-import-duplicate";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

type ImportResultState = {
  createdCount: number;
  failedCount: number;
  created: Array<{ excelRow: number; assetId: string }>;
  errors: Array<{ excelRow: number; message: string }>;
};

type AssetImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssetImportDialog({ open, onOpenChange }: AssetImportDialogProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedAssetImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<AssetImportParseIssue[]>([]);
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
    mutationFn: () => api.bulkImportAssets(parsedRows.map((row) => row.payload)),
    onSuccess: async (result) => {
      const excelRowByIndex = new Map(parsedRows.map((row, index) => [index + 1, row.excelRow]));
      setImportResult({
        createdCount: result.createdCount,
        failedCount: result.failedCount + parseErrors.length,
        created: result.created.map((item) => ({
          excelRow: excelRowByIndex.get(item.row) ?? item.row,
          assetId: item.assetId
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
        queryClient.invalidateQueries({ queryKey: ["assets"] }),
        queryClient.invalidateQueries({ queryKey: ["assets", "stats"] })
      ]);
      if (result.createdCount > 0) {
        toast.success(`${result.createdCount} asset(s) imported`);
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
      const parsed = await readAssetImportFile(file);
      const existingResponse = await api.getAssets({ limit: 5000 });
      const duplicateErrors = findImportDuplicates(parsed.rows, existingResponse.items);
      const duplicateRows = new Set(duplicateErrors.map((item) => item.excelRow));
      const importableRows = parsed.rows.filter((row) => !duplicateRows.has(row.excelRow));
      const allErrors = [...parsed.parseErrors, ...duplicateErrors];

      setParsedRows(importableRows);
      setParseErrors(allErrors);

      if (importableRows.length === 0 && allErrors.length === 0) {
        toast.error("No asset rows found in the Excel file");
      } else if (importableRows.length === 0) {
        toast.error("All rows have errors. Fix the Excel file and try again.");
      } else if (allErrors.length > 0) {
        toast.warning(`${importableRows.length} row(s) ready to import, ${allErrors.length} row(s) skipped`);
      } else {
        toast.success(`${importableRows.length} row(s) ready to import`);
      }
    } catch {
      toast.error("Could not read the Excel file");
      setParsedRows([]);
      setParseErrors([{ excelRow: 0, message: "Invalid or corrupted Excel file" }]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Assets from Excel</DialogTitle>
          <DialogDescription>
            Download the template, fill in asset data, then upload the file. Valid rows are created even if some rows fail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="outline" className="w-full gap-2" onClick={() => downloadAssetImportTemplate()}>
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
              {parsedRows.length} asset row(s) ready to import
              {parseErrors.length > 0 ? ` (${parseErrors.length} row(s) skipped due to format errors)` : ""}.
            </p>
          ) : null}

          {importResult ? (
            <div className="rounded-xl border border-border/50 bg-secondary/20 p-3 space-y-2 max-h-56 overflow-y-auto text-sm">
              <p>
                <span className="font-medium text-emerald-600">{importResult.createdCount} created</span>
                {" · "}
                <span className="font-medium text-destructive">{importResult.failedCount} failed</span>
              </p>
              {importResult.created.length > 0 ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Created</p>
                  <ul className="space-y-1">
                    {importResult.created.map((item) => (
                      <li key={`${item.excelRow}-${item.assetId}`}>
                        Row {item.excelRow}: {item.assetId}
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
                `Import ${parsedRows.length} Asset(s)`
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
