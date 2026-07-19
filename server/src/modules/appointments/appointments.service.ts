import { ApiError } from "../../utils/ApiError.js";
import { findPatientByIdForClinic } from "../patients/patients.repository.js";
import { findDoctorById, isOnLeave } from "../doctors/doctors.repository.js";
import {
  listAppointments,
  findAppointmentById,
  insertAppointment,
  updateStatus as updateStatusRepo,
  reschedule as rescheduleRepo,
  type AppointmentRow,
} from "./appointments.repository.js";

export interface AppointmentDto {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  mrNo: string | null;
  appointmentDate: Date;
  appointmentTime: string;
  visitType: string;
  tokenNo: number;
  status: string;
  remarks: string | null;
  patientName: string;
  fatherHusbandName: string | null;
  gender: string;
  mobileNo: string | null;
  doctorName: string;
  roomNo: string | null;
}

function toDto(row: AppointmentRow): AppointmentDto {
  return {
    appointmentId: row.AppointmentID,
    patientId: row.PatientID,
    doctorId: row.DoctorID,
    mrNo: row.MRNo,
    appointmentDate: row.AppointmentDate,
    appointmentTime: row.AppointmentTime,
    visitType: row.VisitType,
    tokenNo: row.TokenNo,
    status: row.Status,
    remarks: row.Remarks,
    patientName: row.PatientName,
    fatherHusbandName: row.FatherHusbandName,
    gender: row.Gender,
    mobileNo: row.MobileNo,
    doctorName: row.DoctorName,
    roomNo: row.RoomNo,
  };
}

export async function getQueue(
  clinicId: string,
  filters: { date: string; doctorId?: string; status?: string; patientId?: string },
): Promise<AppointmentDto[]> {
  const rows = await listAppointments({ clinicId, ...filters });
  return rows.map(toDto);
}

export async function getAppointment(clinicId: string, appointmentId: string): Promise<AppointmentDto> {
  const row = await findAppointmentById(clinicId, appointmentId);
  if (!row) throw ApiError.notFound("Appointment not found");
  return toDto(row);
}

export interface BookBody {
  patientId: string;
  doctorId: string;
  date: string;
  time?: string;
  visitType: string;
  remarks?: string | null;
}

export async function bookAppointment(clinicId: string, createdBy: string, body: BookBody): Promise<AppointmentDto> {
  const patient = await findPatientByIdForClinic(clinicId, body.patientId);
  if (!patient) throw ApiError.notFound("Patient not found");

  const doctor = await findDoctorById(clinicId, body.doctorId);
  if (!doctor) throw ApiError.notFound("Doctor not found");

  if (await isOnLeave(clinicId, body.doctorId, body.date)) {
    throw ApiError.badRequest("The selected doctor is on leave that day");
  }

  const row = await insertAppointment({
    clinicId,
    patientId: body.patientId,
    doctorId: body.doctorId,
    mrNo: patient.MRNo,
    date: body.date,
    // Walk-in quick-book has no explicit slot time; default to now (HH:mm).
    time: body.time ?? new Date().toISOString().slice(11, 16),
    visitType: body.visitType,
    remarks: body.remarks ?? null,
    createdBy,
  });
  return toDto(row);
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  Scheduled: ["CheckedIn", "Cancelled", "NoShow"],
  CheckedIn: ["InConsultation", "Cancelled", "NoShow"],
  InConsultation: ["Completed", "Cancelled"],
  Completed: [],
  Cancelled: [],
  NoShow: ["Scheduled"],
};

export async function changeStatus(
  clinicId: string,
  appointmentId: string,
  updatedBy: string,
  status: string,
): Promise<AppointmentDto> {
  const current = await findAppointmentById(clinicId, appointmentId);
  if (!current) throw ApiError.notFound("Appointment not found");

  const allowed = VALID_TRANSITIONS[current.Status] ?? [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(`Cannot change status from ${current.Status} to ${status}`);
  }

  const row = await updateStatusRepo(clinicId, appointmentId, status, updatedBy);
  return toDto(row as AppointmentRow);
}

export async function rescheduleAppointment(
  clinicId: string,
  appointmentId: string,
  updatedBy: string,
  date: string,
  time: string,
): Promise<AppointmentDto> {
  const current = await findAppointmentById(clinicId, appointmentId);
  if (!current) throw ApiError.notFound("Appointment not found");
  if (["Completed", "Cancelled"].includes(current.Status)) {
    throw ApiError.badRequest("Completed or cancelled appointments cannot be rescheduled");
  }
  const row = await rescheduleRepo(clinicId, appointmentId, date, time, updatedBy);
  return toDto(row as AppointmentRow);
}
