import { apiGet, apiPost, apiPatch } from "../../api/http";

export interface LabTest {
  labTestId: string;
  name: string;
  category: string | null;
  price: number;
  isActive: boolean;
}

export interface LabOrder {
  labOrderId: string;
  patientId: string;
  labTestId: string;
  status: string;
  orderedAt: string;
  testName: string;
  patientName: string;
  mrNo: string;
  resultText: string | null;
  reviewedAt: string | null;
}

export const labApi = {
  listTests: () => apiGet<LabTest[]>("/lab/tests"),
  createTest: (name: string, category: string | null, price: number) => apiPost<LabTest>("/lab/tests", { name, category, price }),
  listOrders: (params: { patientId?: string; status?: string } = {}) => apiGet<LabOrder[]>("/lab/orders", params),
  order: (patientId: string, labTestId: string, consultationId?: string | null) => apiPost<LabOrder>("/lab/orders", { patientId, labTestId, consultationId }),
  setStatus: (id: string, status: string) => apiPatch<LabOrder>(`/lab/orders/${id}/status`, { status }),
  recordResult: (id: string, resultText: string) => apiPost<LabOrder>(`/lab/orders/${id}/result`, { resultText }),
};
