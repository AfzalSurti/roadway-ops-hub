// ── Users ──
export interface User {
  id: string;
  name: string;
  role: "admin" | "employee";
  avatar: string;
  email: string;
}

export const users: User[] = [
  { id: "u1", name: "Raj Mehta", role: "admin", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=RM&backgroundColor=0ea5e9", email: "raj@highwayops.com" },
  { id: "u2", name: "Priya Sharma", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=PS&backgroundColor=10b981", email: "priya@highwayops.com" },
  { id: "u3", name: "Anil Kumar", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=AK&backgroundColor=f59e0b", email: "anil@highwayops.com" },
  { id: "u4", name: "Meena Das", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=MD&backgroundColor=ef4444", email: "meena@highwayops.com" },
  { id: "u5", name: "Vikram Singh", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=VS&backgroundColor=8b5cf6", email: "vikram@highwayops.com" },
  { id: "u6", name: "Sunita Rao", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=SR&backgroundColor=ec4899", email: "sunita@highwayops.com" },
  { id: "u7", name: "Deepak Joshi", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=DJ&backgroundColor=06b6d4", email: "deepak@highwayops.com" },
  { id: "u8", name: "Kavita Nair", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=KN&backgroundColor=14b8a6", email: "kavita@highwayops.com" },
  { id: "u9", name: "Ramesh Gupta", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=RG&backgroundColor=a855f7", email: "ramesh@highwayops.com" },
  { id: "u10", name: "Lakshmi Iyer", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=LI&backgroundColor=f97316", email: "lakshmi@highwayops.com" },
  { id: "u11", name: "Suresh Patel", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=SP&backgroundColor=22d3ee", email: "suresh@highwayops.com" },
  { id: "u12", name: "Anita Verma", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=AV&backgroundColor=34d399", email: "anita@highwayops.com" },
  { id: "u13", name: "Manoj Tiwari", role: "employee", avatar: "https://api.dicebear.com/7.x/initials/svg?seed=MT&backgroundColor=fb923c", email: "manoj@highwayops.com" },
];

// ── Task types ──
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type Priority = "low" | "medium" | "high" | "urgent";
export type ReportType = "road_inspection" | "material_quality" | "safety_inspection" | "site_progress" | "traffic_survey" | "bridge_inspection" | "maintenance" | "incident";

export const reportTypeLabels: Record<ReportType, string> = {
  road_inspection: "Road Inspection",
  material_quality: "Material Quality",
  safety_inspection: "Safety Inspection",
  site_progress: "Site Progress",
  traffic_survey: "Traffic Survey",
  bridge_inspection: "Bridge Inspection",
  maintenance: "Maintenance",
  incident: "Incident",
};

export const priorityConfig: Record<Priority, { label: string; color: string }> = {
  low: { label: "Low", color: "text-muted-foreground bg-muted" },
  medium: { label: "Medium", color: "text-primary bg-primary/10" },
  high: { label: "High", color: "text-warning bg-warning/10" },
  urgent: { label: "Urgent", color: "text-destructive bg-destructive/10" },
};

export const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  todo: { label: "To Do", color: "text-muted-foreground bg-muted" },
  in_progress: { label: "In Progress", color: "text-primary bg-primary/10" },
  blocked: { label: "Blocked", color: "text-warning bg-warning/10" },
  done: { label: "Done", color: "text-accent bg-accent/10" },
};

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  status: TaskStatus;
  priority: Priority;
  project: string;
  reportType: ReportType;
  createdAt: string;
  checklist?: { id: string; text: string; done: boolean }[];
}

export const tasks: Task[] = [
  { id: "t1", title: "NH-44 Surface Crack Survey", description: "Conduct detailed inspection of surface cracks on NH-44 KM 120-135", assignedTo: "u2", dueDate: "2026-03-05", status: "in_progress", priority: "high", project: "NH-44 Expansion", reportType: "road_inspection", createdAt: "2026-02-28" },
  { id: "t2", title: "Bridge Load Test — Yamuna Crossing", description: "Perform structural load testing on the new Yamuna crossing bridge", assignedTo: "u3", dueDate: "2026-03-04", status: "todo", priority: "urgent", project: "Yamuna Bridge", reportType: "bridge_inspection", createdAt: "2026-02-27" },
  { id: "t3", title: "Safety Gear Audit — Site B", description: "Verify all workers have proper PPE at construction site B", assignedTo: "u4", dueDate: "2026-03-03", status: "done", priority: "medium", project: "NH-44 Expansion", reportType: "safety_inspection", createdAt: "2026-02-25" },
  { id: "t4", title: "Asphalt Sample Testing", description: "Collect and test asphalt samples from recent paving work", assignedTo: "u5", dueDate: "2026-03-06", status: "todo", priority: "medium", project: "Ring Road Phase 2", reportType: "material_quality", createdAt: "2026-02-26" },
  { id: "t5", title: "Traffic Count — Junction 7", description: "Perform 24h traffic count at junction 7 for planning", assignedTo: "u6", dueDate: "2026-03-07", status: "in_progress", priority: "low", project: "Ring Road Phase 2", reportType: "traffic_survey", createdAt: "2026-02-27" },
  { id: "t6", title: "Pothole Repair Documentation", description: "Document pothole repairs completed on SH-12", assignedTo: "u7", dueDate: "2026-03-02", status: "blocked", priority: "high", project: "SH-12 Maintenance", reportType: "maintenance", createdAt: "2026-02-24" },
  { id: "t7", title: "Incident Report — Equipment Failure", description: "File incident report for crane malfunction at site C", assignedTo: "u8", dueDate: "2026-03-01", status: "done", priority: "urgent", project: "NH-44 Expansion", reportType: "incident", createdAt: "2026-02-28" },
  { id: "t8", title: "Weekly Site Progress Report", description: "Compile weekly progress report for all active sites", assignedTo: "u9", dueDate: "2026-03-03", status: "todo", priority: "medium", project: "NH-44 Expansion", reportType: "site_progress", createdAt: "2026-02-27" },
  { id: "t9", title: "Guardrail Inspection — KM 80-95", description: "Inspect guardrail condition and document damage", assignedTo: "u10", dueDate: "2026-03-05", status: "in_progress", priority: "high", project: "SH-12 Maintenance", reportType: "road_inspection", createdAt: "2026-02-26" },
  { id: "t10", title: "Concrete Strength Analysis", description: "Test concrete cylinder samples from bridge pillars", assignedTo: "u11", dueDate: "2026-03-08", status: "todo", priority: "medium", project: "Yamuna Bridge", reportType: "material_quality", createdAt: "2026-02-28" },
  { id: "t11", title: "Emergency Lane Marking", description: "Re-mark emergency lanes on NH-44 after resurfacing", assignedTo: "u12", dueDate: "2026-03-04", status: "todo", priority: "low", project: "NH-44 Expansion", reportType: "maintenance", createdAt: "2026-02-27" },
  { id: "t12", title: "Drainage System Check", description: "Inspect drainage channels along Ring Road section 3", assignedTo: "u13", dueDate: "2026-03-06", status: "in_progress", priority: "medium", project: "Ring Road Phase 2", reportType: "road_inspection", createdAt: "2026-02-25" },
];

// ── Reports ──
export type ReportStatus = "pending" | "approved" | "changes_requested" | "rejected";

export interface Report {
  id: string;
  taskId: string;
  submittedBy: string;
  submittedAt: string;
  status: ReportStatus;
  fields: Record<string, string>;
  attachments: string[];
  feedback?: string;
}

export const reports: Report[] = [
  { id: "r1", taskId: "t3", submittedBy: "u4", submittedAt: "2026-03-01T10:30:00", status: "approved", fields: { "PPE Compliance": "95%", "Hard Hats": "All present", "Safety Vests": "2 missing", "Notes": "Ordered replacement vests" }, attachments: ["safety_photo_1.jpg", "safety_photo_2.jpg"] },
  { id: "r2", taskId: "t7", submittedBy: "u8", submittedAt: "2026-02-28T16:45:00", status: "pending", fields: { "Equipment": "Crane #4", "Incident Type": "Mechanical Failure", "Injuries": "None", "Description": "Hydraulic line failure during lift operation", "Action Taken": "Equipment quarantined, maintenance called" }, attachments: ["incident_1.jpg", "incident_2.jpg", "incident_3.jpg"] },
  { id: "r3", taskId: "t1", submittedBy: "u2", submittedAt: "2026-03-01T14:20:00", status: "changes_requested", fields: { "Section": "KM 120-125", "Crack Type": "Alligator cracking", "Severity": "Moderate", "Recommendation": "Seal coating required" }, attachments: ["crack_survey_1.jpg"], feedback: "Please include photos of KM 125-130 section as well" },
  { id: "r4", taskId: "t5", submittedBy: "u6", submittedAt: "2026-03-02T08:00:00", status: "pending", fields: { "Location": "Junction 7", "Peak Hour Count": "2,340 vehicles/hr", "Off-Peak": "890 vehicles/hr", "Heavy Vehicles %": "18%" }, attachments: ["traffic_data.pdf"] },
];

// ── Templates ──
export interface TemplateField {
  id: string;
  label: string;
  type: "text" | "number" | "date" | "select" | "checkbox" | "photo" | "file" | "textarea";
  required: boolean;
  options?: string[];
}

export interface Template {
  id: string;
  name: string;
  reportType: ReportType;
  fields: TemplateField[];
}

export const templates: Template[] = [
  {
    id: "tmpl1", name: "Road Inspection", reportType: "road_inspection",
    fields: [
      { id: "f1", label: "Section/KM Range", type: "text", required: true },
      { id: "f2", label: "Surface Condition", type: "select", required: true, options: ["Good", "Fair", "Poor", "Critical"] },
      { id: "f3", label: "Defect Type", type: "select", required: true, options: ["Cracking", "Rutting", "Potholes", "Raveling", "Bleeding", "Other"] },
      { id: "f4", label: "Severity", type: "select", required: true, options: ["Low", "Moderate", "High", "Critical"] },
      { id: "f5", label: "Recommendation", type: "textarea", required: true },
      { id: "f6", label: "Photos", type: "photo", required: true },
    ],
  },
  {
    id: "tmpl2", name: "Material Quality", reportType: "material_quality",
    fields: [
      { id: "f1", label: "Material Type", type: "select", required: true, options: ["Asphalt", "Concrete", "Steel", "Aggregate", "Other"] },
      { id: "f2", label: "Sample ID", type: "text", required: true },
      { id: "f3", label: "Test Date", type: "date", required: true },
      { id: "f4", label: "Test Result", type: "text", required: true },
      { id: "f5", label: "Meets Specification", type: "checkbox", required: true },
      { id: "f6", label: "Lab Report", type: "file", required: false },
      { id: "f7", label: "Notes", type: "textarea", required: false },
    ],
  },
  {
    id: "tmpl3", name: "Safety Inspection", reportType: "safety_inspection",
    fields: [
      { id: "f1", label: "Site Name", type: "text", required: true },
      { id: "f2", label: "PPE Compliance %", type: "number", required: true },
      { id: "f3", label: "Hazards Found", type: "textarea", required: false },
      { id: "f4", label: "Corrective Actions", type: "textarea", required: true },
      { id: "f5", label: "Photos", type: "photo", required: true },
    ],
  },
  {
    id: "tmpl4", name: "Site Progress", reportType: "site_progress",
    fields: [
      { id: "f1", label: "Reporting Period", type: "text", required: true },
      { id: "f2", label: "% Complete", type: "number", required: true },
      { id: "f3", label: "Work Done This Period", type: "textarea", required: true },
      { id: "f4", label: "Issues/Delays", type: "textarea", required: false },
      { id: "f5", label: "Next Period Plan", type: "textarea", required: true },
      { id: "f6", label: "Photos", type: "photo", required: false },
    ],
  },
  {
    id: "tmpl5", name: "Traffic Survey", reportType: "traffic_survey",
    fields: [
      { id: "f1", label: "Location", type: "text", required: true },
      { id: "f2", label: "Survey Date", type: "date", required: true },
      { id: "f3", label: "Peak Hour Count", type: "number", required: true },
      { id: "f4", label: "Off-Peak Count", type: "number", required: true },
      { id: "f5", label: "Heavy Vehicle %", type: "number", required: true },
      { id: "f6", label: "Data File", type: "file", required: false },
      { id: "f7", label: "Observations", type: "textarea", required: false },
    ],
  },
  {
    id: "tmpl6", name: "Bridge Inspection", reportType: "bridge_inspection",
    fields: [
      { id: "f1", label: "Bridge Name/ID", type: "text", required: true },
      { id: "f2", label: "Structural Rating", type: "select", required: true, options: ["Excellent", "Good", "Fair", "Poor", "Critical"] },
      { id: "f3", label: "Deck Condition", type: "select", required: true, options: ["No Defects", "Minor Cracks", "Major Cracks", "Spalling", "Corrosion"] },
      { id: "f4", label: "Load Capacity", type: "text", required: true },
      { id: "f5", label: "Recommendations", type: "textarea", required: true },
      { id: "f6", label: "Photos", type: "photo", required: true },
    ],
  },
  {
    id: "tmpl7", name: "Maintenance", reportType: "maintenance",
    fields: [
      { id: "f1", label: "Location", type: "text", required: true },
      { id: "f2", label: "Maintenance Type", type: "select", required: true, options: ["Pothole Repair", "Resurfacing", "Line Marking", "Guardrail", "Signage", "Drainage", "Other"] },
      { id: "f3", label: "Work Description", type: "textarea", required: true },
      { id: "f4", label: "Materials Used", type: "textarea", required: false },
      { id: "f5", label: "Before Photos", type: "photo", required: true },
      { id: "f6", label: "After Photos", type: "photo", required: false },
    ],
  },
  {
    id: "tmpl8", name: "Incident", reportType: "incident",
    fields: [
      { id: "f1", label: "Incident Type", type: "select", required: true, options: ["Equipment Failure", "Accident", "Near Miss", "Environmental", "Security", "Other"] },
      { id: "f2", label: "Date & Time", type: "date", required: true },
      { id: "f3", label: "Location", type: "text", required: true },
      { id: "f4", label: "Description", type: "textarea", required: true },
      { id: "f5", label: "Injuries", type: "select", required: true, options: ["None", "Minor", "Major", "Fatal"] },
      { id: "f6", label: "Action Taken", type: "textarea", required: true },
      { id: "f7", label: "Evidence Photos", type: "photo", required: true },
    ],
  },
];

// ── Chart data ──
export const tasksByStatusData = [
  { status: "To Do", count: 5, fill: "hsl(215, 15%, 55%)" },
  { status: "In Progress", count: 4, fill: "hsl(185, 70%, 50%)" },
  { status: "Blocked", count: 1, fill: "hsl(40, 90%, 55%)" },
  { status: "Done", count: 2, fill: "hsl(160, 70%, 42%)" },
];

export const completionTrendData = [
  { week: "W1", completed: 8, assigned: 12 },
  { week: "W2", completed: 11, assigned: 14 },
  { week: "W3", completed: 7, assigned: 10 },
  { week: "W4", completed: 15, assigned: 16 },
  { week: "W5", completed: 2, assigned: 12 },
];

export const projects = ["NH-44 Expansion", "Yamuna Bridge", "Ring Road Phase 2", "SH-12 Maintenance"];
