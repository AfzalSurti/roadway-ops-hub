import TenderDashboard from "@/pages/tender/Dashboard";

/** HOD Operations uses the same Pre-Contract / Contract UI as Tender, read-only. */
export default function HodOperations() {
  return <TenderDashboard readOnly initialTab="precontract" />;
}
