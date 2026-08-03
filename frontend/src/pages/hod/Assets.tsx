import { Navigate } from "react-router-dom";

/** Legacy path — Assets moved under Admin. */
export default function HodAssets() {
  return <Navigate to="/hod/admin" replace />;
}
