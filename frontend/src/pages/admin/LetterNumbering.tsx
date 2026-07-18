import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { LetterCategory, LetterEntryItem, LetterProjectItem } from "@/lib/domain";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type ViewMode = "new" | "list" | "database";

const SUBJECT_CATEGORIES = ["Utility", "Tender", "LAQ", "Work Order", "Other"];

function SuggestField({
  value,
  onChange,
  onBlur,
  placeholder,
  suggestions
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: (value: string) => void;
  placeholder: string;
  suggestions: string[];
}) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return suggestions.slice(0, 8);
    return suggestions.filter((item) => item.toLowerCase().includes(q)).slice(0, 8);
  }, [suggestions, value]);

  return (
    <div className="relative">
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
          onBlur?.(value);
        }}
        className="h-8 text-xs"
      />
      {open && filtered.length > 0 ? (
        <div className="absolute z-20 mt-1 w-full max-h-40 overflow-auto rounded-lg border border-border/50 bg-card shadow-lg">
          {filtered.map((item) => (
            <button
              key={item}
              type="button"
              className="w-full text-left px-2 py-1.5 text-xs hover:bg-secondary/60"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(item);
                setOpen(false);
              }}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function toDateInput(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

export default function LetterNumbering() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("list");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [syncToMain, setSyncToMain] = useState(true);
  const [form, setForm] = useState({
    projectNumber: "",
    projectCode: "",
    shortName: "",
    fullName: "",
    projectCoordinator: "",
    projectEngineer: "",
    linkedProjectId: ""
  });
  const [importMainId, setImportMainId] = useState("");
  const [importNumber, setImportNumber] = useState("");

  const { data: letterProjects = [], isLoading } = useQuery({
    queryKey: ["letter-projects"],
    queryFn: () => api.getLetterProjects()
  });

  const { data: mainProjects = [] } = useQuery({
    queryKey: ["letter-main-projects"],
    queryFn: () => api.getLetterMainProjects()
  });

  const { data: selectedProject, isLoading: loadingSelected } = useQuery({
    queryKey: ["letter-project", selectedProjectId],
    queryFn: () => (selectedProjectId ? api.getLetterProject(selectedProjectId) : Promise.resolve(null)),
    enabled: Boolean(selectedProjectId) && view === "database"
  });

  const letters = selectedProject?.letters ?? [];

  const suggestionQueries = {
    sentBy: useQuery({
      queryKey: ["letter-suggestions", "sentBy", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "sentBy", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    }),
    sentTo: useQuery({
      queryKey: ["letter-suggestions", "sentTo", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "sentTo", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    }),
    subject: useQuery({
      queryKey: ["letter-suggestions", "subject", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "subject", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    }),
    ccTo: useQuery({
      queryKey: ["letter-suggestions", "ccTo", selectedProjectId],
      queryFn: () => api.getLetterSuggestions({ field: "ccTo", letterProjectId: selectedProjectId ?? undefined }),
      enabled: view === "database" && Boolean(selectedProjectId)
    })
  };

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["letter-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["letter-project", selectedProjectId] }),
      queryClient.invalidateQueries({ queryKey: ["letter-main-projects"] }),
      queryClient.invalidateQueries({ queryKey: ["letter-suggestions"] }),
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createLetterProject({
        ...form,
        projectCode: form.projectCode.toUpperCase(),
        linkedProjectId: form.linkedProjectId || null,
        syncToMainProject: syncToMain
      }),
    onSuccess: async () => {
      toast.success("Letter project added");
      setForm({
        projectNumber: "",
        projectCode: "",
        shortName: "",
        fullName: "",
        projectCoordinator: "",
        projectEngineer: "",
        linkedProjectId: ""
      });
      setView("list");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add project")
  });

  const importMutation = useMutation({
    mutationFn: () => {
      if (!importMainId) throw new Error("Select a project from Project section");
      if (!importNumber.trim()) throw new Error("Enter letter project number (e.g. 376)");
      const main = mainProjects.find((item) => item.id === importMainId);
      return api.importLetterProject({
        mainProjectId: importMainId,
        projectNumber: importNumber.trim(),
        projectCode: (main?.projectNumber || "").toUpperCase() || undefined,
        shortName: main?.name
      });
    },
    onSuccess: async () => {
      toast.success("Project imported into Letter Numbering");
      setImportMainId("");
      setImportNumber("");
      setView("list");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Import failed")
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => api.syncLetterProjectToMain(id),
    onSuccess: async () => {
      toast.success("Added to Project section");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sync failed")
  });

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.deleteLetterProject(id),
    onSuccess: async () => {
      toast.success("Letter project deleted");
      if (selectedProjectId) setSelectedProjectId(null);
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed")
  });

  const addLetterMutation = useMutation({
    mutationFn: (category: LetterCategory) =>
      api.createLetterEntry(selectedProjectId!, {
        category,
        letterDate: new Date().toISOString()
      }),
    onSuccess: async () => {
      toast.success("Letter row added");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to add letter")
  });

  const insertLetterMutation = useMutation({
    mutationFn: (afterLetterId: string) =>
      api.insertLetterEntry(selectedProjectId!, {
        afterLetterId,
        category: "OTHER",
        letterDate: new Date().toISOString()
      }),
    onSuccess: async () => {
      toast.success("Back-dated row inserted");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Insert failed")
  });

  const updateLetterMutation = useMutation({
    mutationFn: ({
      letterId,
      payload
    }: {
      letterId: string;
      payload: Parameters<typeof api.updateLetterEntry>[1];
    }) => api.updateLetterEntry(letterId, payload),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Update failed")
  });

  const deleteLetterMutation = useMutation({
    mutationFn: (letterId: string) => api.deleteLetterEntry(letterId),
    onSuccess: async () => {
      toast.success("Letter deleted");
      await refresh();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Delete failed")
  });

  const filteredProjects = useMemo(() => {
    const q = projectFilter.trim().toLowerCase();
    if (!q) return letterProjects;
    return letterProjects.filter((project) =>
      [project.projectNumber, project.projectCode, project.shortName, project.fullName]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [letterProjects, projectFilter]);

  useEffect(() => {
    if (view === "database" && !selectedProjectId && letterProjects[0]) {
      setSelectedProjectId(letterProjects[0].id);
    }
  }, [view, selectedProjectId, letterProjects]);

  const alreadyLinkedMainIds = useMemo(
    () => new Set(letterProjects.map((item) => item.linkedProjectId).filter(Boolean)),
    [letterProjects]
  );

  const importableMainProjects = mainProjects.filter((item) => !alreadyLinkedMainIds.has(item.id));

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Letter Numbering</h1>
          <p className="page-subtitle">
            DPR Admin letter database — synced with Projects. Geo Designs &amp; Research Pvt. Ltd.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-full self-start">
          {letterProjects.length} letter project(s)
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[240px_1fr] gap-4">
        <div className="glass-panel p-3 space-y-2 h-fit">
          <p className="text-xs font-medium text-muted-foreground px-2 mb-1">Letter Module</p>
          {(
            [
              ["new", "New Project Add"],
              ["list", "All Project List"],
              ["database", "Letter Data Base"]
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                view === key ? "bg-primary text-primary-foreground" : "hover:bg-secondary/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="glass-panel p-5 min-h-[420px]">
          {view === "new" ? (
            <div className="space-y-5 max-w-3xl">
              <div>
                <h2 className="text-lg font-semibold">New Project Add</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a project to the Letter Data Base. Optionally push it into the main Project section.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(
                  [
                    ["projectNumber", "Project Number", "376"],
                    ["projectCode", "Project Code", "GSIR2305R"],
                    ["shortName", "Project Short Name", "Vadodara SOU High-Speed Corridor"],
                    ["projectCoordinator", "Project Coordinator", ""],
                    ["projectEngineer", "Project Engineer", ""]
                  ] as const
                ).map(([key, label, placeholder]) => (
                  <div key={key} className={key === "shortName" ? "sm:col-span-2" : ""}>
                    <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
                    <Input
                      value={form[key]}
                      placeholder={placeholder}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          [key]: key === "projectCode" ? e.target.value.toUpperCase() : e.target.value
                        }))
                      }
                    />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground mb-1.5 block">Project Full Name</label>
                  <textarea
                    value={form.fullName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm outline-none focus:border-primary/50"
                    placeholder="Full consultancy / DPR description"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer rounded-xl border border-border/40 bg-secondary/20 p-3">
                <Checkbox checked={syncToMain} onCheckedChange={(v) => setSyncToMain(v === true)} className="mt-0.5" />
                <span>
                  <span className="text-sm font-medium block">Also add to Project section</span>
                  <span className="text-xs text-muted-foreground">
                    Creates/links a main Project so HOD/Admin project lists stay in sync.
                  </span>
                </span>
              </label>

              <Button
                className="gap-2"
                disabled={
                  !form.projectNumber.trim() ||
                  !form.projectCode.trim() ||
                  !form.shortName.trim() ||
                  createMutation.isPending
                }
                onClick={() => createMutation.mutate()}
              >
                <Plus className="h-4 w-4" />
                {createMutation.isPending ? "Saving..." : "Add Above Project"}
              </Button>

              <div className="border-t border-border/30 pt-5 space-y-3">
                <h3 className="font-semibold">Import from Project section</h3>
                <p className="text-sm text-muted-foreground">
                  Pull an existing Admin/PMO project into Letter Numbering (requires a numeric letter project no.).
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Select value={importMainId} onValueChange={setImportMainId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project from Project section" />
                      </SelectTrigger>
                      <SelectContent>
                        {importableMainProjects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                            {project.projectNumber ? ` (${project.projectNumber})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Letter No. e.g. 376"
                    value={importNumber}
                    onChange={(e) => setImportNumber(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  disabled={!importMainId || !importNumber.trim() || importMutation.isPending}
                  onClick={() => importMutation.mutate()}
                >
                  {importMutation.isPending ? "Importing..." : "Import into Letter Data Base"}
                </Button>
              </div>
            </div>
          ) : null}

          {view === "list" ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">All Project List</h2>
                  <p className="text-sm text-muted-foreground mt-1">Letter Data Base projects</p>
                </div>
                <Input
                  className="sm:max-w-xs"
                  placeholder="Filter projects..."
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[960px]">
                  <thead>
                    <tr className="border-b border-border/40 text-muted-foreground">
                      <th className="py-3 pr-3 text-left font-medium">Sr.</th>
                      <th className="py-3 px-3 text-left font-medium">Project No.</th>
                      <th className="py-3 px-3 text-left font-medium">Project Code</th>
                      <th className="py-3 px-3 text-left font-medium">Short Name</th>
                      <th className="py-3 px-3 text-left font-medium">Full Name</th>
                      <th className="py-3 px-3 text-left font-medium">Synced</th>
                      <th className="py-3 pl-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                          </span>
                        </td>
                      </tr>
                    ) : null}
                    {!isLoading && filteredProjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-muted-foreground">
                          No letter projects yet. Use New Project Add.
                        </td>
                      </tr>
                    ) : null}
                    {filteredProjects.map((project: LetterProjectItem, index) => (
                      <tr key={project.id} className="border-b border-border/20 hover:bg-secondary/20">
                        <td className="py-3 pr-3">{index + 1}</td>
                        <td className="py-3 px-3 font-medium">{project.projectNumber}</td>
                        <td className="py-3 px-3">{project.projectCode}</td>
                        <td className="py-3 px-3">{project.shortName}</td>
                        <td className="py-3 px-3 max-w-[280px] truncate" title={project.fullName}>
                          {project.fullName || "-"}
                        </td>
                        <td className="py-3 px-3">
                          {project.linkedProjectId ? (
                            <Badge variant="secondary">In Projects</Badge>
                          ) : (
                            <Badge variant="outline">Letter only</Badge>
                          )}
                        </td>
                        <td className="py-3 pl-3 text-right">
                          <div className="inline-flex flex-wrap gap-1.5 justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => {
                                setSelectedProjectId(project.id);
                                setView("database");
                              }}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Letters
                            </Button>
                            {!project.linkedProjectId ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="gap-1"
                                disabled={syncMutation.isPending}
                                onClick={() => syncMutation.mutate(project.id)}
                              >
                                <Link2 className="h-3.5 w-3.5" />
                                Add to Projects
                              </Button>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (window.confirm(`Delete letter project ${project.shortName}?`)) {
                                  deleteProjectMutation.mutate(project.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {view === "database" ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">Letter Data Base</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a project, then manage inward / outward / other letters with auto numbering.
                </p>
              </div>

              <div className="rounded-xl border border-border/40 overflow-hidden">
                <div className="bg-secondary/30 px-3 py-2 text-xs font-medium text-muted-foreground grid grid-cols-2 gap-2">
                  <span>Project Number</span>
                  <span>Project Short Name</span>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-border/30">
                  {letterProjects.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">No projects in Letter Data Base yet.</p>
                  ) : (
                    letterProjects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => setSelectedProjectId(project.id)}
                        className={`w-full grid grid-cols-2 gap-2 px-3 py-2.5 text-left text-sm transition-colors ${
                          selectedProjectId === project.id ? "bg-primary/15" : "hover:bg-secondary/30"
                        }`}
                      >
                        <span className="font-medium">{project.projectNumber}</span>
                        <span className="truncate">{project.shortName}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {selectedProjectId && selectedProject ? (
                <>
                  <div className="rounded-lg bg-primary/10 border border-primary/20 px-4 py-2.5 text-sm font-medium">
                    {selectedProject.projectNumber}, {selectedProject.shortName}
                    {!selectedProject.linkedProjectId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-3 h-7"
                        disabled={syncMutation.isPending}
                        onClick={() => syncMutation.mutate(selectedProject.id)}
                      >
                        Add to Project section
                      </Button>
                    ) : (
                      <Badge className="ml-3" variant="secondary">
                        Synced
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={addLetterMutation.isPending}
                      onClick={() => addLetterMutation.mutate("OUTWARD")}
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Outward
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addLetterMutation.isPending}
                      onClick={() => addLetterMutation.mutate("INWARD")}
                    >
                      Add Inward
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={addLetterMutation.isPending}
                      onClick={() => addLetterMutation.mutate("OTHER")}
                    >
                      Add Other
                    </Button>
                  </div>

                  {loadingSelected ? (
                    <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading letters...
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-border/40">
                      <table className="w-full text-xs min-w-[1280px]">
                        <thead>
                          <tr className="bg-secondary/40 text-muted-foreground">
                            <th className="p-2 text-left font-medium w-14">Sr.</th>
                            <th className="p-2 text-left font-medium w-32">Date</th>
                            <th className="p-2 text-left font-medium w-48">Letter Number</th>
                            <th className="p-2 text-left font-medium w-32">Category</th>
                            <th className="p-2 text-left font-medium">Sent By</th>
                            <th className="p-2 text-left font-medium">Sent To</th>
                            <th className="p-2 text-left font-medium">Subject</th>
                            <th className="p-2 text-left font-medium">CC To</th>
                            <th className="p-2 text-left font-medium w-36">Subject Cat.</th>
                            <th className="p-2 text-left font-medium w-28">Linked</th>
                            <th className="p-2 text-right font-medium w-24"> </th>
                          </tr>
                        </thead>
                        <tbody>
                          {letters.length === 0 ? (
                            <tr>
                              <td colSpan={11} className="p-8 text-center text-muted-foreground">
                                No letters yet. Add Inward / Outward / Other.
                              </td>
                            </tr>
                          ) : null}
                          {letters.map((letter: LetterEntryItem, index) => {
                            const isInsert = /[a-z]/i.test(letter.serialLabel);
                            return (
                              <tr
                                key={letter.id}
                                className={`border-t border-border/20 align-top ${isInsert ? "bg-sky-500/5" : ""}`}
                              >
                                <td className="p-2 font-medium">{letter.serialLabel}</td>
                                <td className="p-2">
                                  <Input
                                    type="date"
                                    className="h-8 text-xs"
                                    value={toDateInput(letter.letterDate)}
                                    onChange={(e) =>
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: {
                                          letterDate: e.target.value
                                            ? new Date(`${e.target.value}T00:00:00`).toISOString()
                                            : null
                                        }
                                      })
                                    }
                                  />
                                </td>
                                <td className="p-2 font-mono text-[11px]">{letter.letterNumber || "-"}</td>
                                <td className="p-2">
                                  <Select
                                    value={letter.category}
                                    onValueChange={(value: LetterCategory) =>
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: { category: value }
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="INWARD">Inward</SelectItem>
                                      <SelectItem value="OUTWARD">Outward</SelectItem>
                                      <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </td>
                                {(
                                  [
                                    ["sentBy", suggestionQueries.sentBy.data ?? []],
                                    ["sentTo", suggestionQueries.sentTo.data ?? []],
                                    ["subject", suggestionQueries.subject.data ?? []],
                                    ["ccTo", suggestionQueries.ccTo.data ?? []]
                                  ] as const
                                ).map(([field, suggestions]) => (
                                  <td key={field} className="p-2 min-w-[140px]">
                                    <SuggestField
                                      value={letter[field]}
                                      suggestions={suggestions}
                                      placeholder={field}
                                      onChange={(value) => {
                                        queryClient.setQueryData(
                                          ["letter-project", selectedProjectId],
                                          (prev: LetterProjectItem | null | undefined) => {
                                            if (!prev) return prev;
                                            return {
                                              ...prev,
                                              letters: (prev.letters ?? []).map((item) =>
                                                item.id === letter.id ? { ...item, [field]: value } : item
                                              )
                                            };
                                          }
                                        );
                                      }}
                                      onBlur={(nextValue) =>
                                        updateLetterMutation.mutate({
                                          letterId: letter.id,
                                          payload: { [field]: nextValue }
                                        })
                                      }
                                    />
                                  </td>
                                ))}
                                <td className="p-2">
                                  <Select
                                    value={letter.subjectCategory || "__none__"}
                                    onValueChange={(value) =>
                                      updateLetterMutation.mutate({
                                        letterId: letter.id,
                                        payload: { subjectCategory: value === "__none__" ? "" : value }
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">-</SelectItem>
                                      {SUBJECT_CATEGORIES.map((item) => (
                                        <SelectItem key={item} value={item}>
                                          {item}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                                <td className="p-2">
                                  {letter.letterLinkUrl ? (
                                    <a
                                      href={letter.letterLinkUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary underline"
                                    >
                                      Preview
                                    </a>
                                  ) : (
                                    <Input
                                      className="h-8 text-xs"
                                      placeholder="URL"
                                      defaultValue=""
                                      onBlur={(e) => {
                                        const url = e.target.value.trim();
                                        if (url) {
                                          updateLetterMutation.mutate({
                                            letterId: letter.id,
                                            payload: { letterLinkUrl: url }
                                          });
                                        }
                                      }}
                                    />
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      title="Insert back-dated row below"
                                      onClick={() => insertLetterMutation.mutate(letter.id)}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 w-7 p-0"
                                      onClick={() => {
                                        if (window.confirm("Delete this letter row?")) {
                                          deleteLetterMutation.mutate(letter.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </td>
                                {index < letters.length - 1 ? null : null}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Numbering: Inward/Other use Sr. No. Outward uses{" "}
                    <span className="font-mono">
                      {selectedProject.projectNumber}/{selectedProject.projectCode}/Sr/OutwardSeq
                    </span>
                    . Use + on a row to insert a back-dated letter (3a, 5a…).
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a project above to manage letters.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </PageWrapper>
  );
}
