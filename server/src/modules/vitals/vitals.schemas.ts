import { z } from "zod";

const optNum = (max: number) => z.number().min(0).max(max).optional().nullable();

export const vitalsSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  bpSystolic: z.number().int().min(40).max(300).optional().nullable(),
  bpDiastolic: z.number().int().min(20).max(200).optional().nullable(),
  pulseRate: z.number().int().min(20).max(300).optional().nullable(),
  temperature: optNum(50),
  weight: optNum(500),
  height: optNum(300),
  spO2: z.number().int().min(0).max(100).optional().nullable(),
  bloodSugar: optNum(1000),
});

export type VitalsBody = z.infer<typeof vitalsSchema>;
