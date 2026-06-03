import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AssetCatalogEntry } from "@/hooks/useAssetCatalog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type AssetCatalogManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: AssetCatalogEntry[];
};

export function AssetCatalogManager({ open, onOpenChange, catalog }: AssetCatalogManagerProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [typesText, setTypesText] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [newTypesText, setNewTypesText] = useState("");

  const selected = catalog.find((entry) => entry.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (selected) {
      setClassName(selected.className);
      setTypesText(selected.types.join("\n"));
      return;
    }

    setClassName("");
    setTypesText("");
  }, [open, selected]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["asset-catalog"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!selectedId) {
        throw new Error("Select a class to update");
      }

      return api.updateAssetCatalogEntry(selectedId, {
        className: className.trim(),
        types: typesText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      });
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Asset class updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update asset class")
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createAssetCatalogEntry({
        className: newClassName.trim(),
        types: newTypesText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      }),
    onSuccess: async (entry) => {
      await invalidate();
      setSelectedId(entry.id);
      setNewClassName("");
      setNewTypesText("");
      toast.success("Asset class added");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add asset class")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAssetCatalogEntry(id),
    onSuccess: async () => {
      setSelectedId(null);
      await invalidate();
      toast.success("Asset class deleted");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete asset class")
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Asset Class & Type Setup</DialogTitle>
          <DialogDescription>Manage asset classes and their types used in asset creation forms.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
          <div className="space-y-2">
            <Label>Current Classes</Label>
            <div className="rounded-xl border border-border/40 max-h-72 overflow-y-auto">
              {catalog.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`w-full text-left px-3 py-2 text-sm border-b border-border/20 hover:bg-secondary/40 ${selectedId === entry.id ? "bg-primary/10 text-primary" : ""}`}
                >
                  {entry.className}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {selected ? (
              <>
                <div>
                  <Label>Class Name</Label>
                  <Input value={className} onChange={(event) => setClassName(event.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Asset Types (one per line)</Label>
                  <Textarea value={typesText} onChange={(event) => setTypesText(event.target.value)} className="mt-1 min-h-48" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !className.trim()}>
                    {saveMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => deleteMutation.mutate(selected.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Class
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select a class from the list to edit its types.</p>
            )}

            <div className="rounded-xl border border-border/40 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <h4 className="font-medium">Add New Class</h4>
              </div>
              <div>
                <Label>New Class Name</Label>
                <Input value={newClassName} onChange={(event) => setNewClassName(event.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Asset Types (one per line)</Label>
                <Textarea value={newTypesText} onChange={(event) => setNewTypesText(event.target.value)} className="mt-1 min-h-32" />
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newClassName.trim()}>
                {createMutation.isPending ? "Adding..." : "Add Class"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
