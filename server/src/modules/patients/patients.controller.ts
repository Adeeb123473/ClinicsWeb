import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as patientsService from "./patients.service.js";
import type { PatientBody, SearchQuery, DuplicateQuery } from "./patients.schemas.js";

export const getPatient = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const patient = await patientsService.getPatientById(req.authUser, req.params.id as string);
  sendSuccess(res, patient);
});

export const listPatients = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const query = req.validatedQuery as SearchQuery;
  const { patients, total } = await patientsService.listPatients(req.authUser, query.q, query.page, query.limit);
  sendSuccess(res, patients, 200, { page: query.page, limit: query.limit, total });
});

export const checkDuplicates = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const { cnic, mobile } = req.validatedQuery as DuplicateQuery;
  const dupes = await patientsService.checkDuplicates(req.authUser.clinicId as string, cnic ?? null, mobile ?? null);
  sendSuccess(res, dupes);
});

export const registerPatient = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const patient = await patientsService.registerPatient(
    req.authUser.clinicId as string,
    req.authUser.sub,
    req.body as PatientBody,
  );
  sendSuccess(res, patient, 201);
});

export const updatePatient = asyncHandler(async (req: Request, res: Response) => {
  if (!req.authUser) throw ApiError.unauthorized();
  const patient = await patientsService.editPatient(
    req.authUser.clinicId as string,
    req.authUser.sub,
    req.params.id as string,
    req.body as PatientBody,
  );
  sendSuccess(res, patient);
});
