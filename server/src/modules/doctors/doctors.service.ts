import { ApiError } from "../../utils/ApiError.js";
import {
  listDoctors,
  findDoctorById,
  getSchedule,
  getBookedTimes,
  isOnLeave,
  type DoctorRow,
} from "./doctors.repository.js";

export interface DoctorDto {
  doctorId: string;
  doctorName: string;
  specialization: string | null;
  qualifications: string | null;
  consultationFee: number;
  followUpFee: number;
  roomNo: string | null;
  status: string;
}

export function toDoctorDto(row: DoctorRow): DoctorDto {
  return {
    doctorId: row.DoctorID,
    doctorName: row.DoctorName,
    specialization: row.Specialization,
    qualifications: row.Qualifications,
    consultationFee: Number(row.ConsultationFee),
    followUpFee: Number(row.FollowUpFee),
    roomNo: row.RoomNo,
    status: row.Status,
  };
}

export async function getDoctors(clinicId: string): Promise<DoctorDto[]> {
  return (await listDoctors(clinicId)).map(toDoctorDto);
}

/** Adds minutes to a "HH:mm" string. */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export interface Slot {
  time: string;
  available: boolean;
}

/**
 * Computes bookable slots for a doctor on a date: derived from the day's schedule template,
 * minus already-booked times, minus leave days.
 */
export async function getAvailableSlots(clinicId: string, doctorId: string, date: string): Promise<{
  onLeave: boolean;
  slots: Slot[];
}> {
  const doctor = await findDoctorById(clinicId, doctorId);
  if (!doctor) throw ApiError.notFound("Doctor not found");

  if (await isOnLeave(clinicId, doctorId, date)) {
    return { onLeave: true, slots: [] };
  }

  const dayOfWeek = new Date(`${date}T00:00:00`).getDay(); // 0=Sun..6=Sat
  const schedules = (await getSchedule(clinicId, doctorId)).filter((s) => s.DayOfWeek === dayOfWeek && s.IsActive);
  if (schedules.length === 0) return { onLeave: false, slots: [] };

  const booked = new Set(await getBookedTimes(clinicId, doctorId, date));
  const slots: Slot[] = [];
  for (const sched of schedules) {
    let t = sched.StartTime;
    let guard = 0;
    while (t < sched.EndTime && guard < 200) {
      slots.push({ time: t, available: !booked.has(t) });
      t = addMinutes(t, sched.SlotDurationMinutes);
      guard++;
    }
  }
  return { onLeave: false, slots };
}
