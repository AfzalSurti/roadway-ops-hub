-- Extension of Time period length (months) — distinct from mmEot (the staffing man-months during it).
ALTER TABLE "SubStaffAssignment" ADD COLUMN "eotMonths" DOUBLE PRECISION NOT NULL DEFAULT 0;
