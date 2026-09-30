import AccountsBilling from "@/pages/shared/AccountsBilling";
import { ProjectBillingSummarySection } from "@/components/hod/ProjectBillingSummarySection";

export default function HodAccount() {
  return (
    <>
      <ProjectBillingSummarySection />
      <AccountsBilling
        title="Accounts"
        subtitle="Created RA bills and expenses — filter and review totals (read-only)."
      />
    </>
  );
}
