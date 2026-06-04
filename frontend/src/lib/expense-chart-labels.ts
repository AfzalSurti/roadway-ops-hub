/** Short X-axis labels matching the SITE EXPENSE SHEET column headers */
export const EXPENSE_CHART_SHORT_LABELS: Record<string, string> = {
  "Advance from Office": "Adv from Office",
  "Advance Given to Staff": "Adv Given to Staff",
  "Printing & Stationery": "Printing & Stationary",
  "Site / Office / GH / Misc. Expense": "Site / Office / GH / Misc.",
  Food: "Food",
  "Hotel Rent": "Hotel Rent",
  "Fuel / Petrol / Diesel / CNG": "Fuel / Petrol / CNG",
  "Vehicle Repairs & Maintenance": "Vehicle Repairs",
  "Travel / Auto / Bus / Train / Air": "Travel / Auto / Bus"
};

export function expenseChartShortLabel(categoryName: string) {
  return EXPENSE_CHART_SHORT_LABELS[categoryName] ?? categoryName;
}
