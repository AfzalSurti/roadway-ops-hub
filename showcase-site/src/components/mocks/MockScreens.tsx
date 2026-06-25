import {
  BarChart3,
  FileCheck,
  FolderKanban,
  HardHat,
  Landmark,
  LayoutDashboard,
  ListTodo,
  Package,
  Receipt,
  Settings2,
  UserCircle,
  Users
} from "lucide-react";

const nav = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ListTodo, label: "Tasks" },
  { icon: FileCheck, label: "Reports" },
  { icon: Landmark, label: "Financial" },
  { icon: Receipt, label: "Expenses" },
  { icon: Users, label: "Team" },
  { icon: FolderKanban, label: "Projects" }
];

const kpis = [
  { label: "Active Tasks", value: "47", color: "text-primary" },
  { label: "Overdue", value: "6", color: "text-red-400" },
  { label: "Reports Pending", value: "12", color: "text-amber-400" },
  { label: "Projects", value: "28", color: "text-accent" }
];

export function MockDashboard() {
  return (
    <div className="flex min-h-[280px]">
      <aside className="w-[72px] shrink-0 border-r border-border/40 bg-[hsl(222,24%,6%)] py-3 flex flex-col items-center gap-2">
        {nav.map((item) => (
          <div
            key={item.label}
            className={`p-2 rounded-lg ${item.active ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
          </div>
        ))}
      </aside>
      <div className="flex-1 p-4 min-w-0">
        <p className="text-sm font-semibold text-foreground mb-1">Dashboard</p>
        <p className="text-[10px] text-muted-foreground mb-4">Operations overview</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-lg border border-border/40 bg-card/60 p-2">
              <p className="text-[9px] text-muted-foreground">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border/40 bg-card/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium">Tasks by Project</span>
            <BarChart3 className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex items-end gap-1.5 h-16">
            {[40, 65, 35, 80, 55, 70, 45].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-primary/60 to-primary"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MockProjects() {
  const rows = [
    { no: "PRJ-001", name: "Metro Corridor Phase 1", status: "Active", dpr: "Under Approval" },
    { no: "PRJ-002", name: "Highway Bridge Phase 2", status: "Active", dpr: "Draft Submitted" },
    { no: "PRJ-003", name: "Urban Road DPR", status: "Planning", dpr: "Not Started" }
  ];

  return (
    <div className="p-4 min-h-[260px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold">Project Management</p>
          <p className="text-[10px] text-muted-foreground">Numbering, requisition &amp; import/export</p>
        </div>
        <span className="px-2 py-1 rounded-md bg-primary/15 text-primary text-[9px] font-medium">+ New Project</span>
      </div>
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="grid grid-cols-4 gap-2 px-3 py-2 bg-muted/30 text-[9px] text-muted-foreground font-medium">
          <span>No.</span>
          <span className="col-span-2">Project</span>
          <span>DPR Status</span>
        </div>
        {rows.map((row) => (
          <div key={row.no} className="grid grid-cols-4 gap-2 px-3 py-2.5 border-t border-border/30 text-[10px]">
            <span className="font-mono text-primary">{row.no}</span>
            <span className="col-span-2 text-foreground truncate">{row.name}</span>
            <span className="text-amber-400">{row.dpr}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <span className="px-2 py-1 rounded border border-border/40 text-[9px] text-muted-foreground">Import Excel</span>
        <span className="px-2 py-1 rounded border border-border/40 text-[9px] text-muted-foreground">Export</span>
        <span className="px-2 py-1 rounded border border-border/40 text-[9px] text-muted-foreground">Requisition PDF</span>
      </div>
    </div>
  );
}

export function MockAssets() {
  return (
    <div className="p-4 min-h-[260px]">
      <div className="flex items-center gap-2 mb-4">
        <Package className="h-4 w-4 text-primary" />
        <div>
          <p className="text-sm font-semibold">Asset Management</p>
          <p className="text-[10px] text-muted-foreground">Lifecycle, movements &amp; maintenance</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: "In Use", count: 142, color: "border-primary/40" },
          { label: "In Store", count: 38, color: "border-accent/40" },
          { label: "Under Repair", count: 7, color: "border-amber-500/40" }
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border ${s.color} bg-card/50 p-2 text-center`}>
            <p className="text-lg font-bold">{s.count}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[
          { id: "SV-EQ-042", type: "Total Station", project: "PRJ-002", status: "In Use" },
          { id: "IT-LP-118", type: "Laptop", project: "HQ", status: "In Store" }
        ].map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
            <div>
              <p className="font-mono text-[10px] text-primary">{a.id}</p>
              <p className="text-[9px] text-muted-foreground">{a.type}</p>
            </div>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent">{a.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockExpenses() {
  return (
    <div className="p-4 min-h-[260px]">
      <p className="text-sm font-semibold mb-1">Expense Tracker</p>
      <p className="text-[10px] text-muted-foreground mb-4">Sheets, vouchers &amp; approval workflow</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg border border-border/40 p-2">
          <p className="text-[9px] text-muted-foreground">Pending Review</p>
          <p className="text-xl font-bold text-amber-400">8</p>
        </div>
        <div className="rounded-lg border border-border/40 p-2">
          <p className="text-[9px] text-muted-foreground">Approved This Month</p>
          <p className="text-xl font-bold text-accent">₹4.2L</p>
        </div>
      </div>
      <div className="rounded-lg border border-border/40 p-3 space-y-2">
        <p className="text-[10px] font-medium">Category Breakdown</p>
        {[
          { cat: "Travel", pct: 72 },
          { cat: "Materials", pct: 48 },
          { cat: "Site Visit", pct: 35 }
        ].map((c) => (
          <div key={c.cat}>
            <div className="flex justify-between text-[9px] mb-0.5">
              <span>{c.cat}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: `${c.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MockHodDashboard() {
  return (
    <div className="p-4 min-h-[260px]">
      <p className="text-sm font-semibold mb-1">Executive Dashboard</p>
      <p className="text-[10px] text-muted-foreground mb-3">View-only · Organization-wide visibility</p>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {["All Orgs", "Unit A", "FY 25-26", "Bridges"].map((f) => (
          <span key={f} className="px-2 py-0.5 rounded-full border border-border/50 text-[9px] text-muted-foreground">
            {f}
          </span>
        ))}
      </div>
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <div className="grid grid-cols-5 gap-1 px-2 py-1.5 bg-muted/30 text-[8px] text-muted-foreground">
          <span className="col-span-2">Project</span>
          <span>Tasks</span>
          <span>DPR</span>
          <span>Billing</span>
        </div>
        {[
          { name: "Bridge Phase 2", tasks: "12/18", dpr: "Approval", bill: "RA-3" },
          { name: "Metro Corridor", tasks: "8/14", dpr: "Draft", bill: "RA-1" }
        ].map((r) => (
          <div key={r.name} className="grid grid-cols-5 gap-1 px-2 py-2 border-t border-border/30 text-[9px]">
            <span className="col-span-2 truncate">{r.name}</span>
            <span className="text-primary">{r.tasks}</span>
            <span className="text-amber-400">{r.dpr}</span>
            <span className="text-accent">{r.bill}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary shrink-0" />
        <p className="text-[9px] text-muted-foreground">Activity Gantt chart from live task dates</p>
      </div>
    </div>
  );
}

export function MockFinancial() {
  return (
    <div className="p-4 min-h-[260px]">
      <p className="text-sm font-semibold mb-1">Financial &amp; RA Billing</p>
      <p className="text-[10px] text-muted-foreground mb-4">Planning, excess bills &amp; carry-forward</p>
      <div className="space-y-2">
        {[
          { ra: "RA Bill #3", amount: "₹18,50,000", status: "Received", color: "text-accent" },
          { ra: "RA Bill #4", amount: "₹12,20,000", status: "Put Up", color: "text-amber-400" },
          { ra: "Excess Plan", amount: "₹3,80,000", status: "Planning", color: "text-primary" }
        ].map((b) => (
          <div key={b.ra} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
            <div>
              <p className="text-[10px] font-medium">{b.ra}</p>
              <p className="text-[9px] text-muted-foreground">{b.amount}</p>
            </div>
            <span className={`text-[9px] font-medium ${b.color}`}>{b.status}</span>
          </div>
        ))}
      </div>
      <span className="inline-block mt-3 px-2 py-1 rounded border border-border/40 text-[9px] text-muted-foreground">
        Download RA Bill PDF
      </span>
    </div>
  );
}

export function MockPmoPortal() {
  const pmoNav = [
    { icon: LayoutDashboard, label: "Dashboard", active: false },
    { icon: FolderKanban, label: "Projects", active: true },
    { icon: Package, label: "Assets", active: false }
  ];

  return (
    <div className="flex min-h-[280px]">
      <aside className="w-[72px] shrink-0 border-r border-border/40 bg-[hsl(222,24%,6%)] py-3 flex flex-col items-center gap-2">
        {pmoNav.map((item) => (
          <div
            key={item.label}
            className={`p-2 rounded-lg ${item.active ? "bg-accent/15 text-accent" : "text-muted-foreground"}`}
          >
            <item.icon className="h-4 w-4" />
          </div>
        ))}
      </aside>
      <div className="flex-1 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Settings2 className="h-4 w-4 text-accent" />
          <div>
            <p className="text-sm font-semibold">PMO — Project &amp; Asset Admin</p>
            <p className="text-[10px] text-muted-foreground">Numbering, requisition forms &amp; asset lifecycle</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-2">
            <p className="text-[9px] text-muted-foreground">Projects</p>
            <p className="text-lg font-bold text-accent">28</p>
          </div>
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
            <p className="text-[9px] text-muted-foreground">Assets tracked</p>
            <p className="text-lg font-bold text-primary">187</p>
          </div>
        </div>
        <div className="rounded-lg border border-border/40 overflow-hidden mb-2">
          {[
            { id: "PRJ-002", name: "Highway Bridge Phase 2", req: "PDF Ready" },
            { id: "PRJ-005", name: "Urban Road DPR", req: "Draft" }
          ].map((p) => (
            <div key={p.id} className="flex justify-between px-3 py-2 border-t border-border/30 first:border-t-0 text-[10px]">
              <span>
                <span className="font-mono text-primary">{p.id}</span> — {p.name}
              </span>
              <span className="text-accent">{p.req}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <span className="px-2 py-0.5 rounded border border-border/40 text-[9px]">Assign Number</span>
          <span className="px-2 py-0.5 rounded border border-border/40 text-[9px]">Asset Import</span>
        </div>
      </div>
    </div>
  );
}

export function MockEmployeePortal() {
  const empNav = [
    { icon: LayoutDashboard, label: "Dashboard", active: false },
    { icon: ListTodo, label: "Tasks", active: true },
    { icon: FileCheck, label: "Reports", active: false },
    { icon: Receipt, label: "Expenses", active: false },
    { icon: UserCircle, label: "Profile", active: false }
  ];

  return (
    <div className="flex min-h-[280px]">
      <aside className="w-[72px] shrink-0 border-r border-border/40 bg-[hsl(222,24%,6%)] py-3 flex flex-col items-center gap-2">
        {empNav.map((item) => (
          <div
            key={item.label}
            className={`p-2 rounded-lg ${item.active ? "bg-violet-500/15 text-violet-400" : "text-muted-foreground"}`}
          >
            <item.icon className="h-4 w-4" />
          </div>
        ))}
      </aside>
      <div className="flex-1 p-4">
        <div className="flex items-center gap-2 mb-3">
          <HardHat className="h-4 w-4 text-violet-400" />
          <div>
            <p className="text-sm font-semibold">Employee — My Tasks</p>
            <p className="text-[10px] text-muted-foreground">Assigned work, reports &amp; expense sheets</p>
          </div>
        </div>
        <div className="space-y-2">
          {[
            { title: "Geometric Design — Alignment Review", project: "PRJ-002", due: "3 days", status: "In Progress" },
            { title: "Soil Investigation Report", project: "PRJ-001", due: "Overdue", status: "Blocked" },
            { title: "DPR Draft Submission", project: "PRJ-003", due: "7 days", status: "To Do" }
          ].map((task) => (
            <div key={task.title} className="rounded-lg border border-border/40 px-3 py-2">
              <p className="text-[10px] font-medium truncate">{task.title}</p>
              <div className="flex justify-between mt-1 text-[9px] text-muted-foreground">
                <span>{task.project}</span>
                <span className={task.due === "Overdue" ? "text-red-400" : "text-primary"}>{task.due}</span>
              </div>
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 text-[8px]">
                {task.status}
              </span>
            </div>
          ))}
        </div>
        <span className="inline-block mt-3 px-2 py-1 rounded-md bg-gradient-to-r from-primary/20 to-accent/20 text-[9px] text-primary">
          Submit Report →
        </span>
      </div>
    </div>
  );
}
