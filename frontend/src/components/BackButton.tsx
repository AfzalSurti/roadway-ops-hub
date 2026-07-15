import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

function getHomePath(role?: string | null) {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "PMO") return "/administrative/dashboard";
  if (role === "HOD") return "/hod/dashboard";
  if (role === "INFRA") return "/infra/dashboard";
  return "/app/dashboard";
}

type BackButtonProps = {
  className?: string;
  label?: string;
};

export function BackButton({ className, label = "Back" }: BackButtonProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const homePath = getHomePath(user?.role);

  const canGoBack =
    typeof window !== "undefined" &&
    window.history.length > 1 &&
    location.key !== "default";

  const handleBack = () => {
    if (canGoBack) {
      navigate(-1);
      return;
    }
    navigate(homePath);
  };

  // Hide on the home dashboard itself — nowhere useful to go “back”
  if (location.pathname === homePath) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-secondary/40 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors shrink-0",
        className
      )}
      aria-label={label}
      title={label}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
