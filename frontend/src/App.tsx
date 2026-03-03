import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";

import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminTasks from "./pages/admin/Tasks";
import CreateTask from "./pages/admin/CreateTask";
import AdminReports from "./pages/admin/Reports";
import AdminTemplates from "./pages/admin/Templates";
import AdminTeam from "./pages/admin/Team";
import AdminProjects from "./pages/admin/Projects";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeTasks from "./pages/employee/Tasks";
import TaskDetail from "./pages/employee/TaskDetail";
import EmployeeReports from "./pages/employee/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === "ADMIN" ? "/admin/dashboard" : "/app/dashboard"} replace /> : <Login />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="tasks/new" element={<CreateTask />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="templates" element={<AdminTemplates />} />
        <Route path="team" element={<AdminTeam />} />
        <Route path="projects" element={<AdminProjects />} />
      </Route>

      {/* Employee Routes */}
      <Route path="/app" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="tasks" element={<EmployeeTasks />} />
        <Route path="task/:id" element={<TaskDetail />} />
        <Route path="reports" element={<EmployeeReports />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
