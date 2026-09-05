import type { HoursRequestStatus, LeaveType } from "@prisma/client";
import type { Request, Response } from "express";
import { hoursService } from "../services/hours.service.js";
import { sendSuccess } from "../utils/response.js";

function strParam(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export const hoursController = {
  // ─── Leave ────────────────────────────────────────────────────────────

  async createLeaveRequest(req: Request, res: Response) {
    const result = await hoursService.createLeaveRequest(req.user!.id, req.body);
    return sendSuccess(res, result, 201);
  },

  async listMyLeaveRequests(req: Request, res: Response) {
    const result = await hoursService.listMyLeaveRequests(req.user!.id);
    return sendSuccess(res, result);
  },

  async listAdminLeaveRequests(req: Request, res: Response) {
    const result = await hoursService.listAdminLeaveRequests({
      employeeId: strParam(req.query.employeeId),
      periodId: strParam(req.query.periodId),
      leaveType: strParam(req.query.leaveType) as LeaveType | undefined,
      status: strParam(req.query.status) as HoursRequestStatus | undefined,
      dateFrom: strParam(req.query.dateFrom),
      dateTo: strParam(req.query.dateTo)
    });
    return sendSuccess(res, result);
  },

  async approveLeaveRequest(req: Request, res: Response) {
    const result = await hoursService.reviewLeaveRequest(req.params.id, req.user!.id, true);
    return sendSuccess(res, result);
  },

  async rejectLeaveRequest(req: Request, res: Response) {
    const result = await hoursService.reviewLeaveRequest(
      req.params.id,
      req.user!.id,
      false,
      req.body.rejectionReason
    );
    return sendSuccess(res, result);
  },

  // ─── Overtime ─────────────────────────────────────────────────────────

  async createOvertimeRequest(req: Request, res: Response) {
    const result = await hoursService.createOvertimeRequest(req.user!.id, req.body);
    return sendSuccess(res, result, 201);
  },

  async listMyOvertimeRequests(req: Request, res: Response) {
    const result = await hoursService.listMyOvertimeRequests(req.user!.id);
    return sendSuccess(res, result);
  },

  async listAdminOvertimeRequests(req: Request, res: Response) {
    const result = await hoursService.listAdminOvertimeRequests({
      employeeId: strParam(req.query.employeeId),
      periodId: strParam(req.query.periodId),
      status: strParam(req.query.status) as HoursRequestStatus | undefined,
      dateFrom: strParam(req.query.dateFrom),
      dateTo: strParam(req.query.dateTo)
    });
    return sendSuccess(res, result);
  },

  async approveOvertimeRequest(req: Request, res: Response) {
    const result = await hoursService.reviewOvertimeRequest(req.params.id, req.user!.id, true);
    return sendSuccess(res, result);
  },

  async rejectOvertimeRequest(req: Request, res: Response) {
    const result = await hoursService.reviewOvertimeRequest(
      req.params.id,
      req.user!.id,
      false,
      req.body.rejectionReason
    );
    return sendSuccess(res, result);
  },

  // ─── Combined admin feed + periods ──────────────────────────────────────

  async listAdminRequests(req: Request, res: Response) {
    const result = await hoursService.listAdminRequests({
      employeeId: strParam(req.query.employeeId),
      periodId: strParam(req.query.periodId),
      leaveType: strParam(req.query.leaveType) as LeaveType | undefined,
      requestType: strParam(req.query.requestType) as "LEAVE" | "OVERTIME" | undefined,
      status: strParam(req.query.status) as HoursRequestStatus | undefined,
      dateFrom: strParam(req.query.dateFrom),
      dateTo: strParam(req.query.dateTo)
    });
    return sendSuccess(res, result);
  },

  async listPeriods(_req: Request, res: Response) {
    const result = await hoursService.listPeriods();
    return sendSuccess(res, result);
  },

  async getAllEmployeesReport(req: Request, res: Response) {
    const result = await hoursService.getAllEmployeesReport(strParam(req.query.periodId));
    return sendSuccess(res, result);
  },

  // ─── Summary / breakdown / report ────────────────────────────────────────

  async getMySummary(req: Request, res: Response) {
    const result = await hoursService.getMyHoursSummary(req.user!.id);
    return sendSuccess(res, result);
  },

  async getEmployeeSummary(req: Request, res: Response) {
    const period = strParam(req.query.periodId)
      ? await hoursService.getPeriodById(req.query.periodId as string)
      : await hoursService.getActivePeriod();
    const result = await hoursService.getEmployeeSummary(req.params.id, period);
    return sendSuccess(res, result);
  },

  async getEmployeeBreakdown(req: Request, res: Response) {
    const period = strParam(req.query.periodId)
      ? await hoursService.getPeriodById(req.query.periodId as string)
      : await hoursService.getActivePeriod();
    const result = await hoursService.getEmployeeBreakdown(req.params.id, { id: period.id });
    return sendSuccess(res, result);
  },

  async getEmployeeReport(req: Request, res: Response) {
    const result = await hoursService.getEmployeeReport(req.params.id, strParam(req.query.periodId));
    return sendSuccess(res, result);
  },

  // ─── Converted leave (admin settlement) ─────────────────────────────────

  async convertLeave(req: Request, res: Response) {
    const result = await hoursService.convertUncoveredLeave(
      req.params.id,
      req.body.periodId,
      req.user!.id,
      req.body.reason
    );
    return sendSuccess(res, result, 201);
  },

  async listMyConvertedLeaves(req: Request, res: Response) {
    const result = await hoursService.listMyConvertedLeaves(req.user!.id);
    return sendSuccess(res, result);
  }
};
