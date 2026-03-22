import { useState } from "react";
import { PageWrapper } from "@/components/PageWrapper";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { User, Phone, GraduationCap, Calendar, Briefcase, Pencil, Check, X } from "lucide-react";

function computeExperienceFromDate(dateValue?: string | null) {
  if (!dateValue) return null;
  const start = new Date(dateValue);
  if (Number.isNaN(start.getTime())) return null;

  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 0) months = 0;

  const years = Math.floor(months / 12);
  const remMonths = months % 12;

  if (years === 0) return `${remMonths} month${remMonths === 1 ? "" : "s"}`;
  if (remMonths === 0) return `${years} year${years === 1 ? "" : "s"}`;
  return `${years} year${years === 1 ? "" : "s"} ${remMonths} month${remMonths === 1 ? "" : "s"}`;
}

function computeExperienceFromMonth(monthValue?: string | null) {
  if (!monthValue) return null;
  return computeExperienceFromDate(`${monthValue}-01`);
}

function formatMonthYear(monthValue?: string | null) {
  if (!monthValue) return null;
  const date = new Date(`${monthValue}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return monthValue;
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

export default function EmployeeProfile() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    contactNumber: "",
    education: "",
    yearOfPassing: "",
    dateOfJoining: ""
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
      name: profile?.name ?? "",
      email: profile?.email ?? "",
      contactNumber: profile?.contactNumber ?? "",
      education: profile?.education ?? "",
      yearOfPassing: profile?.yearOfPassing ?? "",
      dateOfJoining: profile?.dateOfJoining ? profile.dateOfJoining.slice(0, 10) : ""
    });
    setEditing(true);
  };

  const handleSave = () => {
    mutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      contactNumber: form.contactNumber.trim() || null,
      education: form.education.trim() || null,
      yearOfPassing: form.yearOfPassing || null,
      dateOfJoining: form.dateOfJoining
        ? new Date(form.dateOfJoining).toISOString()
        : null
    });
  };

  const totalExperienceValue = editing
    ? computeExperienceFromMonth(form.yearOfPassing)
    : profile?.totalExperience ?? computeExperienceFromMonth(profile?.yearOfPassing);

  const orgExperienceValue = editing
    ? computeExperienceFromDate(form.dateOfJoining ? `${form.dateOfJoining}T00:00:00` : null)
    : profile?.experienceInOrg ?? computeExperienceFromDate(profile?.dateOfJoining);

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
        {/* Account Info */}
        <div className="glass-panel p-6">
          <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">Account Information</h3>
          {editing ? (
            <div className="space-y-4">
              <EditRow
                icon={<User className="h-4 w-4" />}
                label="Full Name"
                value={form.name}
                onChange={(v) => setForm((p) => ({ ...p, name: v }))}
                placeholder="e.g. Rahul Sharma"
              />
              <EditRow
                icon={<User className="h-4 w-4" />}
                label="Email Address"
                value={form.email}
                onChange={(v) => setForm((p) => ({ ...p, email: v }))}
                placeholder="e.g. name@company.com"
                type="email"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <ProfileRow icon={<User className="h-4 w-4" />} label="Full Name" value={profile?.name ?? "-"} readOnly />
              <ProfileRow icon={<User className="h-4 w-4" />} label="Email Address" value={profile?.email ?? "-"} readOnly />
            </div>
          )}
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
                  label="Year of Passing"
                  value={form.yearOfPassing}
                  onChange={(v) => setForm((p) => ({ ...p, yearOfPassing: v }))}
                  type="month"
                />
                <EditRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Joining"
                  value={form.dateOfJoining}
                  onChange={(v) => setForm((p) => ({ ...p, dateOfJoining: v }))}
                  type="date"
                />
                <ProfileRow icon={<Briefcase className="h-4 w-4" />} label="Total Experience" value={totalExperienceValue ?? "Not available yet"} readOnly />
                <ProfileRow icon={<Briefcase className="h-4 w-4" />} label="Experience in Organization" value={orgExperienceValue ?? "Not available yet"} readOnly />
              </>
            ) : (
              <>
                <ProfileRow icon={<Phone className="h-4 w-4" />} label="Contact Number" value={profile?.contactNumber ?? null} />
                <ProfileRow icon={<GraduationCap className="h-4 w-4" />} label="Education" value={profile?.education ?? null} />
                <ProfileRow icon={<Calendar className="h-4 w-4" />} label="Year of Passing" value={formatMonthYear(profile?.yearOfPassing)} />
                <ProfileRow
                  icon={<Calendar className="h-4 w-4" />}
                  label="Date of Joining"
                  value={profile?.dateOfJoining ? new Date(profile.dateOfJoining).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null}
                />
                <ProfileRow icon={<Briefcase className="h-4 w-4" />} label="Total Experience" value={profile?.totalExperience ?? null} />
                <ProfileRow icon={<Briefcase className="h-4 w-4" />} label="Experience in Organization" value={profile?.experienceInOrg ?? null} />
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
