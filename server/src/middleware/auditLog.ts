import type { NextFunction, Request, Response } from "express";
import { getPool, sql } from "../config/db.js";

export interface AuditLogEntry {
  clinicId: string | null;
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
}

export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  const pool = await getPool();
  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, entry.clinicId)
    .input("userId", sql.UniqueIdentifier, entry.userId)
    .input("action", sql.NVarChar, entry.action)
    .input("entity", sql.NVarChar, entry.entity)
    .input("entityId", sql.NVarChar, entry.entityId ?? null)
    .input("oldValues", sql.NVarChar(sql.MAX), entry.oldValues ? JSON.stringify(entry.oldValues) : null)
    .input("newValues", sql.NVarChar(sql.MAX), entry.newValues ? JSON.stringify(entry.newValues) : null)
    .input("ipAddress", sql.NVarChar, entry.ipAddress ?? null).query(`
      INSERT INTO AuditLogs (ClinicID, UserID, Action, Entity, EntityID, OldValues, NewValues, IPAddress)
      VALUES (@clinicId, @userId, @action, @entity, @entityId, @oldValues, @newValues, @ipAddress)
    `);
}

/** Fire-and-forget audit logging for clinical-data reads and mutating requests. */
export function auditLog(action: string, entity: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const entityId = req.params.id ?? null;
    recordAuditLog({
      clinicId: req.authUser?.clinicId ?? null,
      userId: req.authUser?.sub ?? null,
      action,
      entity,
      entityId,
      ipAddress: req.ip ?? null,
    }).catch((err) => console.error("audit log write failed:", err));
    next();
  };
}
