import { useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { templates, type Template, type TemplateField } from "@/lib/mock-data";
import { FileText, Plus, ChevronDown, ChevronUp, GripVertical, Trash2, Edit3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const fieldTypes = ["text", "number", "date", "select", "checkbox", "photo", "file", "textarea"] as const;

export default function AdminTemplates() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [localTemplates] = useState(templates);

  const selected = localTemplates.find((t) => t.id === selectedId);

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Report Templates</h1>
        <p className="page-subtitle">Manage report templates for your team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="space-y-3">
          {localTemplates.map((template, i) => (
            <motion.button
              key={template.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => { setSelectedId(template.id); setEditing(false); }}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all",
                selectedId === template.id
                  ? "bg-primary/5 border-primary/20 text-foreground"
                  : "bg-secondary/30 border-border/50 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{template.name}</p>
                  <p className="text-xs text-muted-foreground">{template.fields.length} fields</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Template Detail */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="glass-panel p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold">{selected.name}</h3>
                  <p className="text-sm text-muted-foreground">{selected.fields.length} fields configured</p>
                </div>
                <button
                  onClick={() => setEditing(!editing)}
                  className={cn("px-4 py-2 rounded-xl text-sm font-medium transition-all", editing ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary/50 text-muted-foreground border border-border/50 hover:text-foreground")}
                >
                  <Edit3 className="h-4 w-4 inline mr-2" />
                  {editing ? "Viewing" : "Edit"}
                </button>
              </div>

              <div className="space-y-3">
                {selected.fields.map((field, i) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30"
                  >
                    {editing && (
                      <div className="flex flex-col gap-0.5">
                        <button className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground">
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button className="p-0.5 rounded hover:bg-secondary/50 text-muted-foreground">
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{field.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{field.type}</span>
                        {field.required && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Required</span>}
                        {field.options && <span className="text-xs text-muted-foreground">{field.options.length} options</span>}
                      </div>
                    </div>
                    {editing && (
                      <button className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {editing && (
                <button
                  onClick={() => toast.info("Field editor — mock only")}
                  className="mt-4 w-full py-2.5 rounded-xl border-2 border-dashed border-border/50 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Field
                </button>
              )}
            </div>
          ) : (
            <div className="glass-panel flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">Select a template to view its fields</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
