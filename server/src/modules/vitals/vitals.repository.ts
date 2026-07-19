import { getPool, sql } from "../../config/db.js";
import { assertClinicId } from "../../middleware/tenantScope.js";

export interface VitalRow {
  VitalID: string;
  ClinicID: string;
  PatientID: string;
  AppointmentID: string | null;
  RecordedByUserID: string;
  BPSystolic: number | null;
  BPDiastolic: number | null;
  PulseRate: number | null;
  Temperature: number | null;
  Weight: number | null;
  Height: number | null;
  BMI: number | null;
  SpO2: number | null;
  BloodSugar: number | null;
  RecordedAt: Date;
  RecordedByName?: string;
}

export interface VitalInput {
  clinicId: string;
  patientId: string;
  appointmentId: string | null;
  recordedBy: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulseRate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  spO2: number | null;
  bloodSugar: number | null;
}

export async function insertVital(input: VitalInput): Promise<VitalRow> {
  assertClinicId(input.clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, input.clinicId)
    .input("patientId", sql.UniqueIdentifier, input.patientId)
    .input("appointmentId", sql.UniqueIdentifier, input.appointmentId)
    .input("recordedBy", sql.UniqueIdentifier, input.recordedBy)
    .input("bpSys", sql.Int, input.bpSystolic)
    .input("bpDia", sql.Int, input.bpDiastolic)
    .input("pulse", sql.Int, input.pulseRate)
    .input("temp", sql.Decimal(4, 1), input.temperature)
    .input("weight", sql.Decimal(5, 2), input.weight)
    .input("height", sql.Decimal(5, 2), input.height)
    .input("bmi", sql.Decimal(5, 2), input.bmi)
    .input("spo2", sql.Int, input.spO2)
    .input("sugar", sql.Decimal(6, 2), input.bloodSugar)
    .query<VitalRow>(`
      INSERT INTO Vitals (ClinicID, PatientID, AppointmentID, RecordedByUserID, BPSystolic, BPDiastolic, PulseRate,
        Temperature, Weight, Height, BMI, SpO2, BloodSugar)
      OUTPUT INSERTED.*
      VALUES (@clinicId, @patientId, @appointmentId, @recordedBy, @bpSys, @bpDia, @pulse, @temp, @weight, @height, @bmi, @spo2, @sugar)
    `);
  return result.recordset[0];
}

export async function listVitalsForPatient(clinicId: string, patientId: string, limit = 30): Promise<VitalRow[]> {
  assertClinicId(clinicId);
  const pool = await getPool();
  const result = await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("patientId", sql.UniqueIdentifier, patientId)
    .query<VitalRow>(`
      SELECT TOP ${limit} v.*, u.FullName AS RecordedByName
      FROM Vitals v LEFT JOIN Users u ON u.UserID = v.RecordedByUserID
      WHERE v.ClinicID = @clinicId AND v.PatientID = @patientId
      ORDER BY v.RecordedAt DESC
    `);
  return result.recordset;
}
