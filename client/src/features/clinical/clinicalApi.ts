import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from "../../api/http";

export interface Vital {
  vitalId: string;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulseRate: number | null;
  temperature: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  spO2: number | null;
  bloodSugar: number | null;
  recordedAt: string;
  recordedByName: string | null;
}

export interface Consultation {
  ConsultationID: string;
  AppointmentID: string;
  PatientID: string;
  ChiefComplaint: string | null;
  HistoryOfPresentIllness?: string | null;
  ExaminationNotes?: string | null;
  Diagnosis: string | null;
  ICD10Code?: string | null;
  TreatmentPlan?: string | null;
  FollowUpDate: string | null;
  CreatedAt?: string;
  DoctorName?: string;
}

export interface PrescriptionItem {
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  instructions: string | null;
}

export interface PrescriptionTemplate {
  templateId: string;
  name: string;
  items: PrescriptionItem[];
}

export interface PatientPrescription {
  prescriptionId: string;
  consultationId: string;
  createdAt: string;
  diagnosis: string | null;
  chiefComplaint: string | null;
  doctorName: string;
  items: PrescriptionItem[];
}

export interface PatientHistory {
  patient: {
    patientId: string;
    mrNo: string;
    patientName: string;
    fatherHusbandName: string | null;
    gender: string;
    allergies: string | null;
    chronicConditions: string | null;
    bloodGroup: string | null;
  };
  consultations: Consultation[];
  prescriptions: PatientPrescription[];
  vitals: Vital[];
}

export const clinicalApi = {
  recordVitals: (body: Record<string, unknown>) => apiPost<Vital>("/vitals", body),
  listVitals: (patientId: string) => apiGet<Vital[]>("/vitals", { patientId }),

  getConsultationForAppointment: (appointmentId: string) => apiGet<Consultation | null>("/consultations", { appointmentId }),
  saveConsultation: (body: Record<string, unknown>) => apiPost<Consultation>("/consultations", body),
  updateConsultation: (id: string, body: Record<string, unknown>) => apiPatch<Consultation>(`/consultations/${id}`, body),

  getPrescription: (consultationId: string) => apiGet<{ prescriptionId: string; items: PrescriptionItem[] } | null>("/prescriptions", { consultationId }),
  getPatientPrescriptions: (patientId: string) => apiGet<PatientPrescription[]>("/prescriptions", { patientId }),
  savePrescription: (consultationId: string, items: PrescriptionItem[]) => apiPost<{ items: PrescriptionItem[] }>("/prescriptions", { consultationId, items }),
  listTemplates: () => apiGet<PrescriptionTemplate[]>("/prescriptions/templates"),
  saveTemplate: (name: string, items: PrescriptionItem[]) => apiPost<PrescriptionTemplate>("/prescriptions/templates", { name, items }),
  deleteTemplate: (id: string) => apiDelete<null>(`/prescriptions/templates/${id}`),

  searchMedicines: (q: string) => apiGet<{ medicineId: string; name: string; defaultDosage: string | null }[]>("/medicines", { q }),

  history: (patientId: string) => apiGet<PatientHistory>(`/patients/${patientId}/history`),

  getSchedule: (doctorId: string) =>
    apiGet<{
      doctor: { doctorId: string; doctorName: string };
      schedule: { scheduleId: string; dayOfWeek: number; startTime: string; endTime: string; slotDurationMinutes: number; maxTokens: number | null }[];
      leaves: { leaveId: string; leaveDate: string; reason: string | null }[];
    }>(`/doctors/${doctorId}/schedule`),
  setSchedule: (doctorId: string, slots: unknown[]) => apiPut<{ updated: number }>(`/doctors/${doctorId}/schedule`, { slots }),
  addLeave: (doctorId: string, leaveDate: string, reason: string | null) => apiPost<null>(`/doctors/${doctorId}/leaves`, { leaveDate, reason }),
  removeLeave: (doctorId: string, leaveId: string) => apiDelete<null>(`/doctors/${doctorId}/leaves/${leaveId}`),
};
