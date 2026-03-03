import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { motion } from "framer-motion";
import { FileText, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TemplateField } from "@/lib/domain";

type TemplateFieldDraft = {
  id: string;
  label: string;
  type: TemplateField["type"];
  required: boolean;
  optionsText: string;
};

const fieldTypeOptions: Array<TemplateField["type"]> = ["text", "textarea", "number", "date", "select", "checkbox", "photo", "file"];

const createEmptyField = (): TemplateFieldDraft => ({
  id: `field_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
  label: "",
  type: "text",
  required: false,
  optionsText: ""
});

export default function AdminTemplates() {
  const { data: templates = [], refetch } = useQuery({ queryKey: ["templates"], queryFn: () => api.getTemplates() });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<TemplateFieldDraft[]>([createEmptyField()]);

  const selected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [templates, selectedId]
  );

  const createTemplate = async () => {
    const cleanName = name.trim();
    if (!cleanName) {
      toast.error("Template name is required");
      return;
    }

    const normalizedFields = fields
      .map((field, index) => {
        const label = field.label.trim();
        const options = field.type === "select"
          ? field.optionsText.split(",").map((option) => option.trim()).filter(Boolean)
          : undefined;
        return {
          id: field.id || `field_${index + 1}`,
          label,
          type: field.type,
          required: field.required,
          options
        };
      })
      .filter((field) => field.label.length > 0);

    if (!normalizedFields.length) {
      toast.error("Add at least one field with a label");
      return;
    }

    const invalidSelect = normalizedFields.find((field) => field.type === "select" && (!field.options || !field.options.length));
    if (invalidSelect) {
      toast.error(`Select field \"${invalidSelect.label}\" needs options`);
      return;
    }

    try {
      await api.createTemplate({
        name: cleanName,
        description: description.trim(),
        fields: normalizedFields
      });
      toast.success("Template created");
      setShowCreate(false);
      setName("");
      setDescription("");
      setFields([createEmptyField()]);
      await refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create template";
      toast.error(message);
    }
  };

  const updateField = (fieldId: string, patch: Partial<TemplateFieldDraft>) => {
    setFields((prev) => prev.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)));
  };

  const removeField = (fieldId: string) => {
    setFields((prev) => {
      const next = prev.filter((field) => field.id !== fieldId);
      return next.length ? next : [createEmptyField()];
    });
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
            onClick={() => setShowCreate(true)}
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

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel-strong p-6 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Create Report Template</h3>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1 rounded-lg hover:bg-secondary/50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none focus:border-primary/50"
                placeholder="Template name (e.g. Daily Site Progress)"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-foreground outline-none resize-none focus:border-primary/50"
                placeholder="Description (optional)"
              />

              <div className="space-y-3 pt-1">
                {fields.map((field, index) => (
                  <div key={field.id} className="rounded-xl border border-border/50 p-4 bg-secondary/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Field {index + 1}</p>
                      <button
                        onClick={() => removeField(field.id)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                        type="button"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        value={field.label}
                        onChange={(event) => updateField(field.id, { label: event.target.value })}
                        className="md:col-span-2 px-3 py-2 rounded-lg bg-secondary/40 border border-border/40 text-sm outline-none focus:border-primary/50"
                        placeholder="Field label"
                      />
                      <select
                        value={field.type}
                        onChange={(event) => updateField(field.id, { type: event.target.value as TemplateField["type"] })}
                        className="px-3 py-2 rounded-lg bg-secondary/40 border border-border/40 text-sm outline-none focus:border-primary/50"
                      >
                        {fieldTypeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    {field.type === "select" && (
                      <input
                        value={field.optionsText}
                        onChange={(event) => updateField(field.id, { optionsText: event.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-secondary/40 border border-border/40 text-sm outline-none focus:border-primary/50"
                        placeholder="Options (comma separated), e.g. Clear, Rain, Fog"
                      />
                    )}

                    <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(event) => updateField(field.id, { required: event.target.checked })}
                      />
                      Required field
                    </label>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setFields((prev) => [...prev, createEmptyField()])}
                  className="w-full py-2 rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                >
                  + Add Another Field
                </button>
              </div>

              <button
                onClick={() => void createTemplate()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Save Template
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </PageWrapper>
  );
}