import { useMemo, useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";

const manpowerGroups = ["Key Personnel", "Sub Professional Staff", "Support Staff"] as const;

const roleOptions: Record<(typeof manpowerGroups)[number], string[]> = {
  "Key Personnel": [
    "Team Leader Cum Senior Highway Engineer",
    "Resident Cum Highway Engineer (2 Nos)",
    "Bridge / Structural Engineer",
    "Senior Pavement Specialist",
    "Senior Quality Cum Material Expert",
    "Road Safety Expert"
  ],
  "Sub Professional Staff": [
    "Highway Design Engineer",
    "Bridge / Structure Design Engineer",
    "Survey Engineer (2 Nos)",
    "Assistant Highway Engineer (3 Nos)",
    "CAD Expert",
    "Environmental Engineer",
    "Assistant Bridge Engineer (2 Nos)",
    "Assistant Quality Cum Material Engineer (3 Nos)",
    "Electrical Engineer",
    "HTMS / Toll Expert",
    "Quantity Surveyor",
    "Horticulture Cum Landscaping Expert"
  ],
  "Support Staff": ["Office Manager", "Computer Operator", "Accountant", "Office Boy"]
};

type Draft = {
  name: string;
  email: string;
  phone: string;
  manpowerGroup: (typeof manpowerGroups)[number];
  manpowerRole: string;
  monthlyCost: string;
  notes: string;
};

const EMPTY_DRAFT: Draft = {
  name: "",
  email: "",
  phone: "",
  manpowerGroup: "Key Personnel",
  manpowerRole: roleOptions["Key Personnel"][0],
  monthlyCost: "",
  notes: ""
};

function parseMonthlyCost(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return undefined;
  if (num < 0 || num > 10_000_000) return undefined;
  return Number(num.toFixed(2));
}

export default function InfraTeam() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const { data: team = [] } = useQuery({ queryKey: ["infra-team"], queryFn: () => api.getInfraTeamMembers() });
  const selected = team.find((item) => item.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return team;
    return team.filter((member) => [member.name, member.email, member.manpowerGroup, member.manpowerRole, member.currentProject].filter(Boolean).join(" ").toLowerCase().includes(query));
  }, [search, team]);

  const createMutation = useMutation({
    mutationFn: () => {
      const monthlyCost = parseMonthlyCost(draft.monthlyCost);
      if (monthlyCost === undefined) throw new Error("Enter a valid monthly cost (optional, must be ≥ 0)");
      return api.createInfraTeamMember({
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        manpowerGroup: draft.manpowerGroup,
        manpowerRole: draft.manpowerRole.trim(),
        monthlyCost,
        notes: draft.notes.trim() || null
      });
    },
    onSuccess: async () => {
      toast.success("Team member created");
      setOpen(false);
      setDraft(EMPTY_DRAFT);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["infra-team"] }), queryClient.invalidateQueries({ queryKey: ["infra-overview"] })]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to create team member")
  });

  const updateMutation = useMutation({
    mutationFn: () => {
      const monthlyCost = parseMonthlyCost(draft.monthlyCost);
      if (monthlyCost === undefined) throw new Error("Enter a valid monthly cost (optional, must be ≥ 0)");
      return api.updateInfraTeamMember(selectedId!, {
        name: draft.name.trim(),
        email: draft.email.trim() || null,
        phone: draft.phone.trim() || null,
        manpowerGroup: draft.manpowerGroup,
        manpowerRole: draft.manpowerRole.trim(),
        monthlyCost,
        notes: draft.notes.trim() || null
      });
    },
    onSuccess: async () => {
      toast.success("Team member updated");
      setOpen(false);
      setSelectedId(null);
      setDraft(EMPTY_DRAFT);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["infra-team"] }), queryClient.invalidateQueries({ queryKey: ["infra-overview"] })]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update team member")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInfraTeamMember(id),
    onSuccess: async () => {
      toast.success("Team member removed");
      setSelectedId(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["infra-team"] }), queryClient.invalidateQueries({ queryKey: ["infra-overview"] })]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete team member")
  });

  const beginCreate = () => {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setOpen(true);
  };

  const beginEdit = (member = selected) => {
    if (!member) return;
    setSelectedId(member.id);
    setDraft({
      name: member.name,
      email: member.email ?? "",
      phone: member.phone ?? "",
      manpowerGroup: member.manpowerGroup,
      manpowerRole: member.manpowerRole,
      monthlyCost: member.monthlyCost != null ? String(member.monthlyCost) : "",
      notes: member.notes ?? ""
    });
    setOpen(true);
  };

  return (
    <PageWrapper>
      <div className="page-header flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="page-title">Infra Team</h1>
          <p className="page-subtitle">Store team roster, roles, and mobilization status.</p>
        </div>
        <Button className="gap-2" onClick={beginCreate}><Plus className="h-4 w-4" />Add Member</Button>
      </div>

      <div className="glass-panel p-4 mb-6 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-10" placeholder="Search name, role, project, or group" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((member) => (
          <button key={member.id} onClick={() => setSelectedId(member.id)} className="text-left task-card hover:scale-[1.01] transition-transform">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{member.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{member.email || "No email"}</p>
              </div>
              <Badge variant="secondary">{member.manpowerGroup}</Badge>
            </div>
            <p className="text-sm mt-3">{member.manpowerRole}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Monthly cost: {member.monthlyCost != null ? `₹${Number(member.monthlyCost).toLocaleString("en-IN")}` : "Not set"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{member.currentProject ? `Mobilized on ${member.currentProject}` : "Not mobilized"}</p>
          </button>
        ))}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={() => setSelectedId(null)}>
          <div className="w-full max-w-xl bg-card border-l border-border h-full overflow-y-auto p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Team Member Profile</h3>
              <button aria-label="Close profile" onClick={() => setSelectedId(null)} className="p-1.5 rounded-lg hover:bg-secondary/50"><X className="h-4 w-4" /></button>
            </div>

            <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 space-y-2 mb-4">
              <p className="font-semibold text-lg">{selected.name}</p>
              <p className="text-sm text-muted-foreground">{selected.email || "No email"}</p>
              <p className="text-sm">{selected.manpowerGroup} · {selected.manpowerRole}</p>
              <p className="text-sm text-muted-foreground">
                Monthly Cost: {selected.monthlyCost != null ? `₹${Number(selected.monthlyCost).toLocaleString("en-IN")}` : "Not set"}
              </p>
              <p className="text-sm text-muted-foreground">Current Project: {selected.currentProject || "None"}</p>
              <p className="text-sm text-muted-foreground">Mobilized: {selected.mobilizedAt ? new Date(selected.mobilizedAt).toLocaleDateString("en-IN") : "-"}</p>
              <p className="text-sm text-muted-foreground">Demobilized: {selected.demobilizedAt ? new Date(selected.demobilizedAt).toLocaleDateString("en-IN") : "-"}</p>
            </div>

            <div className="flex gap-2 mb-4">
              <Button variant="outline" className="gap-2" onClick={() => beginEdit(selected)}><Pencil className="h-4 w-4" />Edit</Button>
              <Button variant="destructive" className="gap-2" onClick={() => deleteMutation.mutate(selected.id)} disabled={deleteMutation.isPending}>Delete</Button>
            </div>

            <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 space-y-3 mb-4">
              <p className="font-semibold">Project Assignments</p>
              {(selected.projectAssignments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Not assigned to any project yet.</p>
              ) : (
                (selected.projectAssignments ?? []).map((assignment) => (
                  <div key={assignment.id} className="rounded-xl border border-border/30 bg-background/40 p-3">
                    <p className="text-sm font-medium">{assignment.project.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{assignment.project.projectNumber || "No project number"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mobilized: {assignment.mobilizedAt ? new Date(assignment.mobilizedAt).toLocaleDateString("en-IN") : "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Demobilized: {assignment.demobilizedAt ? new Date(assignment.demobilizedAt).toLocaleDateString("en-IN") : "Active"}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border border-border/40 bg-secondary/20 p-4 space-y-2">
              <p className="font-semibold">Notes</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selected.notes || "No notes provided"}</p>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="glass-panel-strong p-6 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">{selectedId ? "Edit Team Member" : "Add Team Member"}</h3>
              <button aria-label="Close form" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-secondary/50"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid gap-3">
              <Input placeholder="Name" value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} />
              <Input placeholder="Email" type="email" value={draft.email} onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))} />
              <Input placeholder="Phone" value={draft.phone} onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))} />

              <div>
                <label htmlFor="monthly-cost" className="text-xs text-muted-foreground mb-1.5 block">
                  Per month cost (optional)
                </label>
                <Input
                  id="monthly-cost"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 75000"
                  value={draft.monthlyCost}
                  onChange={(e) => setDraft((prev) => ({ ...prev, monthlyCost: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Leave blank if not applicable. Used for project staff billing (30-day month).</p>
              </div>

              <Select value={draft.manpowerGroup} onValueChange={(value) => setDraft((prev) => ({ ...prev, manpowerGroup: value as Draft["manpowerGroup"], manpowerRole: roleOptions[value as Draft["manpowerGroup"]][0] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{manpowerGroups.map((group) => <SelectItem key={group} value={group}>{group}</SelectItem>)}</SelectContent>
              </Select>

              <Select value={draft.manpowerRole} onValueChange={(value) => setDraft((prev) => ({ ...prev, manpowerRole: value }))}>
                <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roleOptions[draft.manpowerGroup].map((role) => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectContent>
              </Select>

              <Textarea placeholder="Notes" value={draft.notes} onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))} />

              <Button className="gap-2" onClick={() => (selectedId ? updateMutation.mutate() : createMutation.mutate())} disabled={createMutation.isPending || updateMutation.isPending}>
                {selectedId ? "Save Changes" : "Create Member"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}