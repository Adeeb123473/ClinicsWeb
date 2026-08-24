import { apiGet, apiGetWithMeta, apiPost, apiPatch } from "../../api/http";

export interface Age {
  value: number;
  unit: "Years" | "Months" | "Days";
}

export interface Patient {
  PatientID: string;
  MRNo: string;
  PatientName: string;
  FatherHusbandName: string | null;
  Gender: string;
  ActualDOB: string | null;
  EstimatedDOB: string | null;
  MobileNo: string | null;
  CNIC: string | null;
  Address: string | null;
  Category: string;
  BloodGroup?: string | null;
  Allergies?: string | null;
  ChronicConditions?: string | null;
  EmergencyContactName: string | null;
  EmergencyContactPhone: string | null;
  InsuranceProvider: string | null;
  InsurancePolicyNo: string | null;
  Remarks: string | null;
  RegistrationDate: string;
  currentAge: Age | null;
}

export interface DuplicateMatch {
  patientId: string;
  mrNo: string;
  patientName: string;
  fatherHusbandName: string | null;
  mobileNo: string | null;
  cnic: string | null;
  matchedOn: string[];
}

export interface Doctor {
  doctorId: string;
  doctorName: string;
  specialization: string | null;
  qualifications: string | null;
  consultationFee: number;
  followUpFee: number;
  roomNo: string | null;
  status: string;
}

export interface Slot {
  time: string;
  available: boolean;
}

export interface Appointment {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  mrNo: string | null;
  appointmentDate: string;
  appointmentTime: string;
  visitType: string;
  tokenNo: number;
  status: string;
  remarks: string | null;
  consultationFee: number | null;
  patientName: string;
  fatherHusbandName: string | null;
  gender: string;
  mobileNo: string | null;
  doctorName: string;
  roomNo: string | null;
}

export interface InvoiceSummary {
  invoiceId: string;
  patientId: string;
  appointmentId: string | null;
  invoiceNo: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  status: string;
  createdAt: string;
  patientName: string;
  mrNo: string;
}

export interface Invoice extends InvoiceSummary {
  items: { description: string; quantity: number; unitPrice: number; amount: number; labOrderId: string | null }[];
  payments: { paymentId: string; amount: number; method: string; paidAt: string }[];
}

export interface LabTest {
  labTestId: string;
  name: string;
  category: string | null;
  price: number;
  isActive: boolean;
}

/** Reception's billing view of a lab order — no result text (see lab.service.getBillableOrders). */
export interface BillableLabOrder {
  labOrderId: string;
  patientId: string;
  labTestId: string;
  testName: string;
  price: number;
  status: string;
  orderedAt: string;
  mrNo: string;
}

export const clinicApi = {
  searchPatients: (q: string, page = 1, limit = 20) => apiGetWithMeta<Patient[]>("/patients", { q: q || undefined, page, limit }),
  getPatient: (id: string) => apiGet<Patient>(`/patients/${id}`),
  checkDuplicates: (mobile?: string) => apiGet<DuplicateMatch[]>("/patients/duplicates", { mobile }),
  registerPatient: (body: Record<string, unknown>) => apiPost<Patient>("/patients", body),
  updatePatient: (id: string, body: Record<string, unknown>) => apiPatch<Patient>(`/patients/${id}`, body),

  listDoctors: () => apiGet<Doctor[]>("/doctors"),
  getSlots: (doctorId: string, date: string) => apiGet<{ onLeave: boolean; slots: Slot[] }>(`/doctors/${doctorId}/slots`, { date }),

  getQueue: (params: { date?: string; doctorId?: string; status?: string; patientId?: string }) =>
    apiGet<Appointment[]>("/appointments", params),
  getAppointment: (id: string) => apiGet<Appointment>(`/appointments/${id}`),
  book: (body: Record<string, unknown>) => apiPost<Appointment>("/appointments", body),
  setStatus: (id: string, status: string) => apiPatch<Appointment>(`/appointments/${id}/status`, { status }),
  reschedule: (id: string, date: string, time: string) => apiPatch<Appointment>(`/appointments/${id}/reschedule`, { date, time }),

  listInvoices: (params: { patientId?: string; status?: string } = {}) => apiGet<InvoiceSummary[]>("/billing/invoices", params),
  getInvoice: (id: string) => apiGet<Invoice>(`/billing/invoices/${id}`),
  createInvoice: (body: Record<string, unknown>) => apiPost<Invoice>("/billing/invoices", body),
  recordPayment: (id: string, amount: number, method: string) => apiPost<Invoice>(`/billing/invoices/${id}/payments`, { amount, method }),

  listLabTests: () => apiGet<LabTest[]>("/lab/tests"),
  listBillableLabOrders: (patientId: string) => apiGet<BillableLabOrder[]>("/lab/orders/billable", { patientId }),
};
