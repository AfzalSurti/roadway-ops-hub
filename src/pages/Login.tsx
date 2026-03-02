import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { HardHat, Shield, User } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Login() {
  const [selectedRole, setSelectedRole] = useState<"admin" | "employee">("admin");
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    login(selectedRole);
    navigate(selectedRole === "admin" ? "/admin/dashboard" : "/app/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4 glow-primary">
            <HardHat className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">HighwayOps</h1>
          <p className="text-muted-foreground mt-2">Task & Report Management</p>
        </div>

        {/* Card */}
        <div className="glass-panel-strong p-8">
          <h2 className="text-lg font-semibold mb-6 text-center">Select your role to continue</h2>

          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { role: "admin" as const, icon: Shield, label: "Admin", desc: "Highway Engineer" },
              { role: "employee" as const, icon: User, label: "Employee", desc: "Team Member" },
            ].map(({ role, icon: Icon, label, desc }) => (
              <motion.button
                key={role}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedRole(role)}
                className={cn(
                  "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200",
                  selectedRole === role
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-border hover:bg-secondary/50"
                )}
              >
                <Icon className="h-8 w-8" />
                <div className="text-center">
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </motion.button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold transition-all duration-200 hover:opacity-90 disabled:opacity-50 glow-primary"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Signing in…
              </span>
            ) : (
              "Continue to Dashboard"
            )}
          </motion.button>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Demo mode — no credentials required
          </p>
        </div>
      </motion.div>
    </div>
  );
}
