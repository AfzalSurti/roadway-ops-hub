import { useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { User, Phone, GraduationCap, Calendar, Briefcase, IndianRupee, Pencil, Check, X } from "lucide-react";

export default function EmployeeProfile() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    contactNumber: "",
    education: "",
    dateOfJoining: "",
    experienceInOrg: "",
    currentCtc: ""
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.getProfile(),
    staleTime: 30000
  });

  const mutation = useMutation({
    mutationFn: (payload: typeof form) => api.updateProfile(payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", "me"], updated);
      setEditing(false);
      toast.success("Profile updated successfully");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    }
  });

  const startEditing = () => {
    setForm({
      contactNumber: profile?.contactNumber ?? "",
      education: profile?.education ?? "",
      dateOfJoining: profile?.dateOfJoining ? profile.dateOfJoining.slice(0, 10) : "",
      experienceInOrg: profile?.experienceInOrg ?? "",
      currentCtc: profile?.currentCtc ?? ""
    });
    setEditing(true);
  };

  const handleSave = () => {
    mutation.mutate({
      contactNumber: form.contactNumber.trim() || null,
      education: form.education.trim() || null,
      dateOfJoining: form.dateOfJoining
        ? new Date(form.dateOfJoining).toISOString()
        : null,
      experienceInOrg: form.experienceInOrg.trim() || null,
      currentCtc: form.currentCtc.trim() || null
    } as typeof form);
  };

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">Loading profile...</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="page-header flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">View and update your personal details</p>
        </div>
        {!editing ? (
          <button
            onClick={startEditing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <Pencil className="h-4 w-4" />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {mutation.isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 text-sm hover:bg-secondary/50 transition-colors"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Account Info (read-only) */}
        <div className="glass-panel p-6">
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Account Information</h3>
          <div className="space-y-4">
            <ProfileRow icon={<User className="h-4 w-4" />} label="Full Name" value={profile?.name ?? "-"} readOnly />
            <ProfileRow icon={<User className="h-4 w-4" />} label="Email Address" value={profile?.email ?? "-"} readOnly />
          </div>
        </div>

        {/* Editable Details */}
        <div className="glass-panel p-6">
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Personal Details</h3>
          <div className="space-y-4">
            {editing ? (
              <>
                <EditRow
                  icon={<Phone className="h-4 w-4" />}
                  label="Contact Number"
                  value={form.contactNumber}
                  onChange={(v) => setForm((p) => ({ ...p, contactNumber: v }))}
                  placeholder="e.g. +91 9876543210"
                  type="tel"
                />
                <EditRow
                  icon={<GraduationCap className="h-4 w-4" />}
                  label="Education"
                  value={form.education}
                  onChange={(v) => setForm((p) => ({ ...p, education: v }))}
                  placeholder="e.g. B.Tech Civil Engineering"
                />
                <EditRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Joining"
                  value={form.dateOfJoining}
                  onChange={(v) => setForm((p) => ({ ...p, dateOfJoining: v }))}
                  type="date"
                />
                <EditRow
                  icon={<Briefcase className="h-4 w-4" />}
                  label="Experience in Organization"
                  value={form.experienceInOrg}
                  onChange={(v) => setForm((p) => ({ ...p, experienceInOrg: v }))}
                  placeholder="e.g. 2 years 3 months"
                />
                <EditRow
                  icon={<IndianRupee className="h-4 w-4" />}
                  label="Current CTC"
                  value={form.currentCtc}
                  onChange={(v) => setForm((p) => ({ ...p, currentCtc: v }))}
                  placeholder="e.g. 6,00,000 per annum"
                />
              </>
            ) : (
              <>
                <ProfileRow icon={<Phone className="h-4 w-4" />} label="Contact Number" value={profile?.contactNumber ?? null} />
                <ProfileRow icon={<GraduationCap className="h-4 w-4" />} label="Education" value={profile?.education ?? null} />
                <ProfileRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Joining"
                  value={profile?.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null}
                />
                <ProfileRow icon={<Briefcase className="h-4 w-4" />} label="Experience in Organization" value={profile?.experienceInOrg ?? null} />
                <ProfileRow icon={<IndianRupee className="h-4 w-4" />} label="Current CTC" value={profile?.currentCtc ?? null} />
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}

function ProfileRow({ icon, label, value, readOnly }: { icon: React.ReactNode; label: string; value: string | null | undefined; readOnly?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className={`text-sm ${!value ? "text-muted-foreground italic" : "text-foreground"} ${readOnly ? "" : ""}`}>
          {value ?? "Not provided"}
        </p>
      </div>
    </div>
  );
}

function EditRow({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-3 text-muted-foreground shrink-0">{icon}</div>
      <div className="flex-1">
        <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground outline-none focus:border-primary/50 transition-colors"
        />
      </div>
    </div>
  );
}
