import TenderDashboard from "@/pages/tender/Dashboard";

/** HOD sees the same tender / pre-contract / contract UI as Tender, but read-only (no Add / Edit / Delete). */
export default function HodTender() {
  return <TenderDashboard readOnly />;
}
