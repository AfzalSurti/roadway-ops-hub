import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppLayout } from "@/components/AppLayout";
import { BackendReadyGate } from "@/components/BackendReadyGate";

import Login from "./pages/Login";
import Index from "./pages/Index";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminTasks from "./pages/admin/Tasks";
import CreateTask from "./pages/admin/CreateTask";
import AdminReports from "./pages/admin/Reports";
import AdminFinancial from "./pages/admin/Financial";
import AdminTeam from "./pages/admin/Team";
import AdminProjects from "./pages/admin/Projects";
import EmployeeDashboard from "./pages/employee/Dashboard";
import EmployeeTasks from "./pages/employee/Tasks";
import TaskDetail from "./pages/employee/TaskDetail";
import EmployeeReports from "./pages/employee/Reports";
import EmployeeProfile from "./pages/employee/Profile";
import NotFound from "./pages/NotFound";
import AdministrativeDashboard from "./pages/administrative/Dashboard";
import AssetManagement from "./pages/administrative/AssetManagement";
import AssetDetail from "./pages/administrative/AssetDetail";
import HodDashboard from "./pages/hod/Dashboard";
import ExpenseDashboard from "./pages/admin/ExpenseDashboard";
import ExpenseList from "./pages/admin/ExpenseList";
import AdminExpenseDetail from "./pages/admin/ExpenseDetail";
import AdminMyExpenses from "./pages/admin/AdminMyExpenses";
import ExpenseVouchers from "./pages/admin/ExpenseVouchers";
import ExpenseReports from "./pages/admin/ExpenseReports";
import EmployeeExpenses from "./pages/employee/Expenses";
import EmployeeExpenseDetail from "./pages/employee/ExpenseDetail";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 10000,
      refetchIntervalInBackground: true
    }
  }
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function getLandingPath(role?: string | null) {
  if (role === "ADMIN") return "/admin/dashboard";
  if (role === "PMO") return "/administrative/dashboard";
  if (role === "HOD") return "/hod/dashboard";
  return "/app/dashboard";
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to={getLandingPath(user.role)} replace />;
  return <>{children}</>;
}

function PmoRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "PMO") return <Navigate to={getLandingPath(user.role)} replace />;
  return <>{children}</>;
}

function HodRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "HOD") return <Navigate to={getLandingPath(user.role)} replace />;
  return <>{children}</>;
}

function EmployeeRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "EMPLOYEE") return <Navigate to={getLandingPath(user.role)} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={getLandingPath(user.role)} replace /> : <Login />} />
      <Route path="/" element={user ? <Navigate to={getLandingPath(user.role)} replace /> : <Index />} />

      {/* Admin Routes */}
      <Route path="/admin" element={<AdminRoute><AppLayout /></AdminRoute>}>
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="tasks/new" element={<CreateTask />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="financial" element={<AdminFinancial />} />
        <Route path="team" element={<AdminTeam />} />
        <Route path="projects" element={<AdminProjects />} />
        <Route path="expenses">
          <Route index element={<ExpenseDashboard />} />
          <Route path="my">
            <Route index element={<AdminMyExpenses />} />
            <Route path=":sheetId" element={<AdminExpenseDetail />} />
          </Route>
          <Route path="list" element={<ExpenseList />} />
          <Route path="vouchers" element={<ExpenseVouchers />} />
          <Route path="reports" element={<ExpenseReports />} />
          <Route path=":sheetId" element={<AdminExpenseDetail />} />
        </Route>
      </Route>

      <Route path="/administrative" element={<PmoRoute><AppLayout /></PmoRoute>}>
        <Route path="dashboard" element={<AdministrativeDashboard />} />
        <Route path="project-management" element={<AdminProjects />} />
        <Route path="assets" element={<AssetManagement />} />
        <Route path="assets/:id" element={<AssetDetail />} />
      </Route>

      <Route path="/hod" element={<HodRoute><AppLayout /></HodRoute>}>
        <Route path="dashboard" element={<HodDashboard />} />
      </Route>

      {/* Employee Routes */}
      <Route path="/app" element={<EmployeeRoute><AppLayout /></EmployeeRoute>}>
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="tasks" element={<EmployeeTasks />} />
        <Route path="task/:id" element={<TaskDetail />} />
        <Route path="reports" element={<EmployeeReports />} />
        <Route path="profile" element={<EmployeeProfile />} />
        <Route path="expenses" element={<EmployeeExpenses />} />
        <Route path="expenses/:id" element={<EmployeeExpenseDetail />} />
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
      <BackendReadyGate>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </BackendReadyGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
