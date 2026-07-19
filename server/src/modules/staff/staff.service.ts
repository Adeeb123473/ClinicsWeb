import { ApiError } from "../../utils/ApiError.js";
import { hashPassword } from "../../utils/password.js";
import { findUserByUsername } from "../users/users.repository.js";
import {
  listStaff,
  findStaffById,
  insertStaff,
  updateStaff,
  updateDoctorProfile,
  setStaffPassword,
  type StaffRow,
} from "./staff.repository.js";
import type { CreateStaffBody, UpdateStaffBody } from "./staff.schemas.js";

export interface StaffDto {
  userId: string;
  username: string;
  role: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date;
  doctor: {
    doctorId: string;
    specialization: string | null;
    consultationFee: number;
    followUpFee: number;
    roomNo: string | null;
  } | null;
}

function toDto(row: StaffRow): StaffDto {
  return {
    userId: row.UserID,
    username: row.Username,
    role: row.Role,
    fullName: row.FullName,
    email: row.Email,
    phone: row.Phone,
    status: row.Status,
    lastLoginAt: row.LastLoginAt,
    createdAt: row.CreatedAt,
    doctor: row.DoctorID
      ? {
          doctorId: row.DoctorID,
          specialization: row.Specialization,
          consultationFee: Number(row.ConsultationFee ?? 0),
          followUpFee: Number(row.FollowUpFee ?? 0),
          roomNo: row.RoomNo,
        }
      : null,
  };
}

export async function getStaff(clinicId: string): Promise<StaffDto[]> {
  return (await listStaff(clinicId)).map(toDto);
}

export async function createStaff(clinicId: string, createdBy: string, body: CreateStaffBody): Promise<StaffDto> {
  const existing = await findUserByUsername(body.username);
  if (existing) throw ApiError.conflict("That username is already taken", "USERNAME_TAKEN");

  const passwordHash = await hashPassword(body.password);
  const userId = await insertStaff({
    clinicId,
    username: body.username,
    passwordHash,
    role: body.role,
    fullName: body.fullName,
    email: body.email ?? null,
    phone: body.phone ?? null,
    createdBy,
    doctor:
      body.role === "DOCTOR"
        ? {
            specialization: body.specialization ?? null,
            consultationFee: body.consultationFee ?? 0,
            followUpFee: body.followUpFee ?? 0,
            roomNo: body.roomNo ?? null,
            qualifications: body.qualifications ?? null,
            licenseNo: body.licenseNo ?? null,
          }
        : undefined,
  });

  const created = await findStaffById(clinicId, userId);
  return toDto(created as StaffRow);
}

export async function editStaff(
  clinicId: string,
  actingUserId: string,
  userId: string,
  body: UpdateStaffBody,
): Promise<StaffDto> {
  const existing = await findStaffById(clinicId, userId);
  if (!existing) throw ApiError.notFound("Staff member not found");

  // An admin cannot deactivate their own account (would lock themselves out).
  if (userId === actingUserId && body.status === "Inactive") {
    throw ApiError.badRequest("You cannot deactivate your own account");
  }

  await updateStaff(clinicId, userId, {
    fullName: body.fullName,
    email: body.email ?? null,
    phone: body.phone ?? null,
    status: body.status,
  });

  if (existing.Role === "DOCTOR") {
    await updateDoctorProfile(clinicId, userId, {
      specialization: body.specialization ?? existing.Specialization,
      consultationFee: body.consultationFee ?? Number(existing.ConsultationFee ?? 0),
      followUpFee: body.followUpFee ?? Number(existing.FollowUpFee ?? 0),
      roomNo: body.roomNo ?? existing.RoomNo,
    });
  }

  const updated = await findStaffById(clinicId, userId);
  return toDto(updated as StaffRow);
}

export async function resetStaffPassword(clinicId: string, userId: string, newPassword: string): Promise<void> {
  const existing = await findStaffById(clinicId, userId);
  if (!existing) throw ApiError.notFound("Staff member not found");
  await setStaffPassword(clinicId, userId, await hashPassword(newPassword));
}
