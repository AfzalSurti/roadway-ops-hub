import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { expenseChartShortLabel } from "@/lib/expense-chart-labels";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const mainChartConfig = {
  amount: { label: "Amount (Rs.)", color: "hsl(185 70% 45%)" }
};

const breakdownChartConfig = {
  amount: { label: "Amount (Rs.)", color: "hsl(220 60% 55%)" }
};

function formatRs(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

export function ExpenseEmployeeCategoryCharts() {
  const [employeeId, setEmployeeId] = useState("");

  const { data: bootstrap, isLoading: bootstrapLoading } = useQuery({
    queryKey: ["expense-employee-analytics-bootstrap"],
    queryFn: () => api.getExpenseEmployeeCategoryAnalytics(),
    staleTime: 60_000
  });

  useEffect(() => {
    if (!employeeId && bootstrap?.employees.length) {
      setEmployeeId(bootstrap.employees[0].id);
    }
  }, [bootstrap?.employees, employeeId]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["expense-employee-analytics", employeeId],
    queryFn: () => api.getExpenseEmployeeCategoryAnalytics(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 30_000
  });

  const employees = analytics?.employees ?? bootstrap?.employees ?? [];

  const mainChartData = useMemo(() => {
    return (analytics?.categories ?? []).map((row) => ({
      categoryId: row.categoryId,
      shortLabel: expenseChartShortLabel(row.categoryName),
      fullName: row.categoryName,
      amount: row.total
    }));
  }, [analytics?.categories]);

  const categoriesWithSpend = useMemo(
    () => (analytics?.categories ?? []).filter((c) => c.total > 0),
    [analytics?.categories]
  );

  const loading = bootstrapLoading || (Boolean(employeeId) && analyticsLoading);

  return (
    <div className="glass-panel p-5 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-semibold text-lg">Expense by category (employee)</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Amount on each bar is total spend in that expense class for the selected employee.
          </p>
        </div>
        <div className="w-full sm:w-72">
          <label className="text-xs text-muted-foreground mb-1 block">Employee</label>
          <Select value={employeeId} onValueChange={setEmployeeId} disabled={employees.length === 0}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground inline-flex items-center gap-2 py-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading charts…
        </p>
      ) : null}

      {!loading && employees.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6">No employee expense entries yet.</p>
      ) : null}

      {!loading && employees.length > 0 ? (
        <>
          <ChartContainer config={mainChartConfig} className="h-[320px] w-full aspect-auto">
            <BarChart data={mainChartData} margin={{ top: 8, right: 8, left: 4, bottom: 56 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="shortLabel"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-40}
                textAnchor="end"
                height={72}
                tick={{ fontSize: 9 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatRs(Number(value))}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return row?.fullName ?? "";
                    }}
                  />
                }
              />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ChartContainer>

          <div className="rounded-lg border border-border/50 bg-secondary/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <span className="text-sm text-muted-foreground">Total amount (all categories)</span>
            <span className="text-xl font-bold tabular-nums">{formatRs(analytics?.totalAmount ?? 0)}</span>
          </div>

          <div>
            <h4 className="font-semibold mb-3">Breakdown within each category</h4>
            <p className="text-xs text-muted-foreground mb-4">
              Each chart shows individual entries (date and description) for that category.
            </p>
            {categoriesWithSpend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expenses recorded for this employee.</p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {categoriesWithSpend.map((category) => {
                  const breakdownData = category.breakdown.map((item, index) => ({
                    id: `${category.categoryId}-${index}`,
                    label: item.label.length > 28 ? `${item.label.slice(0, 28)}…` : item.label,
                    fullLabel: item.label,
                    amount: item.amount
                  }));

                  return (
                    <div key={category.categoryId} className="rounded-lg border border-border/40 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-medium leading-tight">{category.categoryName}</p>
                        <p className="text-sm font-semibold tabular-nums shrink-0">{formatRs(category.total)}</p>
                      </div>
                      <ChartContainer config={breakdownChartConfig} className="h-[200px] w-full aspect-auto">
                        <BarChart data={breakdownData} margin={{ top: 4, right: 4, left: 0, bottom: 48 }}>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                            angle={-35}
                            textAnchor="end"
                            height={56}
                            tick={{ fontSize: 8 }}
                          />
                          <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 9 }} />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => formatRs(Number(value))}
                                labelFormatter={(_, payload) => {
                                  const row = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                                  return row?.fullLabel ?? "";
                                }}
                              />
                            }
                          />
                          <Bar dataKey="amount" fill="var(--color-amount)" radius={[3, 3, 0, 0]} maxBarSize={32} />
                        </BarChart>
                      </ChartContainer>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
