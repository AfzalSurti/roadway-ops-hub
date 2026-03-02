import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function AdminTemplates() {
  const { data: templates = [], refetch } = useQuery({ queryKey: ["templates"], queryFn: () => api.getTemplates() });
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [templates, selectedId]
  );

  const createTemplate = async () => {
    const name = window.prompt("Template name");
    if (!name) {
      return;
    }

    const fieldsJson = window.prompt("Template fields JSON array");

    if (!fieldsJson) {
      return;
    }

    try {
      const parsedFields = JSON.parse(fieldsJson);
      await api.createTemplate({
        name,
        description: "",
        fields: parsedFields
      });
      toast.success("Template created");
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create template";
      toast.error(message);
    }
  };

  return (
    <PageWrapper>
      <div className="page-header">
        <h1 className="page-title">Report Templates</h1>
        <p className="page-subtitle">Manage report templates for your team</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {templates.map((template, index) => (
            <motion.button
              key={template.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => setSelectedId(template.id)}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all",
                selected?.id === template.id
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

          <button
            onClick={() => void createTemplate()}
            className="w-full py-2.5 rounded-xl border-2 border-dashed border-border/50 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Template
          </button>
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="glass-panel p-6">
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <p className="text-sm text-muted-foreground mb-4">{selected.fields.length} fields configured</p>
              <div className="space-y-3">
                {selected.fields.map((field) => (
                  <div key={field.id} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{field.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{field.type}</span>
                        {field.required && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">Required</span>}
                        {field.options && <span className="text-xs text-muted-foreground">{field.options.length} options</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-panel flex flex-col items-center justify-center h-64 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No template found</p>
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}