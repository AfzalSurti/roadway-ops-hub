import { useLocation } from "react-router-dom";
import ExpenseSheetPage from "@/pages/shared/ExpenseSheetPage";

export default function AdminExpenseDetail() {
  const location = useLocation();
  const selfService = location.pathname.includes("/admin/expenses/my");

  return (
    <ExpenseSheetPage
      basePath={selfService ? "/admin/expenses/my" : "/admin/expenses"}
      selfService={selfService}
    />
  );
}
