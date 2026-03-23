import { Outlet, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { ChatAssistant } from "@/components/ChatAssistant";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X } from "lucide-react";
import { useState } from "react";

function ProfileIncompletePrompt() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => api.getProfile(),
    staleTime: 60000
  });

  const isIncomplete = profile && !profile.contactNumber;

  if (!isIncomplete || dismissed) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/10 border-b border-primary/20 text-sm">
      <span className="flex-1 text-foreground">
        <strong>Complete your profile</strong> — please add your contact number, education, and other details.
      </span>
      <button
        onClick={() => navigate("/app/profile")}
        className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity"
      >
        Complete Profile
      </button>
      <button
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AppLayout() {
  const { isAdmin } = useAuth();

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        {!isAdmin && <ProfileIncompletePrompt />}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
      <ChatAssistant />
    </div>
  );
}

