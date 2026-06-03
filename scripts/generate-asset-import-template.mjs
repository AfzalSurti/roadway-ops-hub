import * as XLSX from "xlsx";
import { mkdirSync } from "node:fs";

const headers = [
  "Asset Class*",
  "Asset Type*",
  "Mark / Model",
  "Date of Purchase",
  "Warranty End Date",
  "Purchase Amount",
  "GST",
  "Status*",
  "Project Number",
  "Project Name",
  "Assigned User",
  "Assigned Date",
  "IT Asset ID",
  "Remarks",
  "For Month",
  "Sold Amount",
  "Sold Remark"
];

const emptyRow = Object.fromEntries(headers.map((header) => [header, ""]));
const blankRows = Array.from({ length: 48 }, () => ({ ...emptyRow }));

const instructions = [
  ["ASSET DATA COLLECTION - INSTRUCTIONS"],
  [""],
  ["1. Fill only the Assets sheet. Do not change column headers in row 1."],
  ["2. Delete the 2 sample rows (rows 2-3) before import, or replace them with your data."],
  ["3. Enter one asset per row starting from row 2."],
  [""],
  ["REQUIRED: Asset Class*, Asset Type*, Status*"],
  ["Project Number is required when Status = IN_USE"],
  [""],
  ["STATUS: IN_USE | IN_STORE | UNDER_REPAIR | SOLD"],
  ["DATES: DD/MM/YYYY (example: 12/03/2024)"],
  ["AMOUNTS: numbers only, no rupee symbol"],
  [""],
  ["Duplicates are not allowed (already existing assets or duplicate Excel rows are skipped)."]
];

const assetsSheet = XLSX.utils.json_to_sheet(blankRows, { header: headers });
assetsSheet["!cols"] = headers.map((header) => ({ wch: Math.max(16, header.length + 2) }));
assetsSheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
instructionsSheet["!cols"] = [{ wch: 72 }];

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, assetsSheet, "Assets");
XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

mkdirSync("frontend/public/templates", { recursive: true });
const outPath = "frontend/public/templates/asset-import-template.xlsx";
XLSX.writeFile(workbook, outPath);
console.log(`Wrote ${outPath}`);
