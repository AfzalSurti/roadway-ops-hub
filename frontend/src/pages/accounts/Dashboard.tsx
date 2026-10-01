import { useNavigate } from "react-router-dom";
import AccountsBilling from "@/pages/shared/AccountsBilling";
import { ProjectBillingSummarySection } from "@/components/hod/ProjectBillingSummarySection";

export default function AccountsDashboard() {
  const navigate = useNavigate();

  return (
    <>
      <ProjectBillingSummarySection
        onSelectProject={(projectId) => navigate(`/accounts/billing?project=${projectId}`)}
      />
      <AccountsBilling
        title="Accounts Overview"
        subtitle="RA bills and expenses across every project — filter and review totals."
      />
    </>
  );
}
