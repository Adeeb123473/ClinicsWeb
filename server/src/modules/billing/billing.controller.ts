import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as service from "./billing.service.js";
import type { CreateInvoiceBody, PaymentBody, InvoiceQuery } from "./billing.schemas.js";

function clinicId(req: Request): string {
  if (!req.authUser?.clinicId) throw ApiError.unauthorized();
  return req.authUser.clinicId;
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const q = req.validatedQuery as InvoiceQuery;
  sendSuccess(res, await service.getInvoices(clinicId(req), q.patientId, q.status));
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  sendSuccess(res, await service.getInvoice(clinicId(req), req.params.id as string));
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const invoice = await service.createInvoice(clinicId(req), req.authUser.sub, req.body as CreateInvoiceBody);
  sendSuccess(res, invoice, 201);
});

export const pay = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const { amount, method } = req.body as PaymentBody;
  sendSuccess(res, await service.recordPayment(clinicId(req), req.params.id as string, req.authUser.sub, amount, method));
});
