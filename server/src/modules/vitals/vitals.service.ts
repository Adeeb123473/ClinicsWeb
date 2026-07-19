import { ApiError } from "../../utils/ApiError.js";
import { findPatientByIdForClinic } from "../patients/patients.repository.js";
import { insertVital, listVitalsForPatient, type VitalRow } from "./vitals.repository.js";

/** BMI = weight(kg) / height(m)^2. Height is stored in cm. Server recomputes it so the
 *  displayed BMI can never disagree with the recorded weight/height. */
export function computeBmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  if (m <= 0) return null;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

function toDto(row: VitalRow) {
  return {
    vitalId: row.VitalID,
    patientId: row.PatientID,
    appointmentId: row.AppointmentID,
    bpSystolic: row.BPSystolic,
    bpDiastolic: row.BPDiastolic,
    pulseRate: row.PulseRate,
    temperature: row.Temperature === null ? null : Number(row.Temperature),
    weight: row.Weight === null ? null : Number(row.Weight),
    height: row.Height === null ? null : Number(row.Height),
    bmi: row.BMI === null ? null : Number(row.BMI),
    spO2: row.SpO2,
    bloodSugar: row.BloodSugar === null ? null : Number(row.BloodSugar),
    recordedAt: row.RecordedAt,
    recordedByName: row.RecordedByName ?? null,
  };
}

export interface VitalsBody {
  patientId: string;
  appointmentId?: string | null;
  bpSystolic?: number | null;
  bpDiastolic?: number | null;
  pulseRate?: number | null;
  temperature?: number | null;
  weight?: number | null;
  height?: number | null;
  spO2?: number | null;
  bloodSugar?: number | null;
}

export async function recordVitals(clinicId: string, recordedBy: string, body: VitalsBody) {
  const patient = await findPatientByIdForClinic(clinicId, body.patientId);
  if (!patient) throw ApiError.notFound("Patient not found");

  const bmi = computeBmi(body.weight ?? null, body.height ?? null);
  const row = await insertVital({
    clinicId,
    patientId: body.patientId,
    appointmentId: body.appointmentId ?? null,
    recordedBy,
    bpSystolic: body.bpSystolic ?? null,
    bpDiastolic: body.bpDiastolic ?? null,
    pulseRate: body.pulseRate ?? null,
    temperature: body.temperature ?? null,
    weight: body.weight ?? null,
    height: body.height ?? null,
    bmi,
    spO2: body.spO2 ?? null,
    bloodSugar: body.bloodSugar ?? null,
  });
  return toDto(row);
}

export async function getPatientVitals(clinicId: string, patientId: string) {
  return (await listVitalsForPatient(clinicId, patientId)).map(toDto);
}
