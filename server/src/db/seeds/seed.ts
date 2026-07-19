import { getPool, sql, closePool } from "../../config/db.js";
import { runMigrations } from "../migrate.js";
import { hashPassword } from "../../utils/password.js";
import { env } from "../../config/env.js";

interface SeedDoctor {
  username: string;
  fullName: string;
  specialization: string;
  roomNo: string;
}

const DOCTORS: SeedDoctor[] = [
  { username: "dr.ahmed", fullName: "Dr. Ahmed Raza", specialization: "General Medicine", roomNo: "101" },
  { username: "dr.fatima", fullName: "Dr. Fatima Sheikh", specialization: "Pediatrics", roomNo: "102" },
];

const PATIENTS = [
  { name: "Muhammad Ali", father: "Ghulam Rasool", gender: "Male", dob: "1985-03-12", mobile: "03001234567", cnic: "35202-1234567-1", category: "General" },
  { name: "Ayesha Bibi", father: "Nazir Ahmed", gender: "Female", dob: "1990-07-22", mobile: "03011234567", cnic: "35202-1234567-2", category: "Deserving" },
  { name: "Bilal Hussain", father: "Iqbal Hussain", gender: "Male", dob: "1978-11-05", mobile: "03021234567", cnic: "35202-1234567-3", category: "General" },
  { name: "Sana Javed", father: "Javed Iqbal", gender: "Female", dob: "1995-01-30", mobile: "03031234567", cnic: "35202-1234567-4", category: "Insurance" },
  { name: "Usman Tariq", father: "Tariq Mehmood", gender: "Male", dob: "2000-09-14", mobile: "03041234567", cnic: "35202-1234567-5", category: "General" },
  { name: "Zainab Fatima", father: "Rashid Ali", gender: "Female", dob: "1988-05-18", mobile: "03051234567", cnic: "35202-1234567-6", category: "Deserving" },
  { name: "Hassan Raza", father: "Raza Muhammad", gender: "Male", dob: "1972-12-01", mobile: "03061234567", cnic: "35202-1234567-7", category: "Staff" },
  { name: "Mariam Yousaf", father: "Yousaf Khan", gender: "Female", dob: "2010-04-09", mobile: "03071234567", cnic: null, category: "General" },
  { name: "Imran Sultan", father: "Sultan Mehmood", gender: "Male", dob: "1965-08-25", mobile: "03081234567", cnic: "35202-1234567-8", category: "General" },
  { name: "Sadia Kanwal", father: "Kanwal Ahmed", gender: "Female", dob: "1993-02-17", mobile: "03091234567", cnic: "35202-1234567-9", category: "Insurance" },
];

async function alreadySeeded(pool: sql.ConnectionPool): Promise<boolean> {
  const result = await pool
    .request()
    .input("username", sql.NVarChar, env.seed.superAdminUsername)
    .query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM Users WHERE Username = @username`);
  return result.recordset[0].cnt > 0;
}

async function seed(): Promise<void> {
  console.log("Running pending migrations...");
  await runMigrations();

  const pool = await getPool();

  if (await alreadySeeded(pool)) {
    console.log("Seed data already present (super admin exists). Skipping.");
    await closePool();
    return;
  }

  console.log("Seeding subscription plans...");
  const planResult = await pool.request().query<{ PlanID: string }>(`
    INSERT INTO SubscriptionPlans (Name, PriceMonthly, MaxUsers, MaxPatients, Features)
    OUTPUT INSERTED.PlanID
    VALUES ('Professional', 99.00, 25, 5000, '["appointments","billing","reports","lab"]')
  `);
  const planId = planResult.recordset[0].PlanID;

  await pool.request().query(`
    INSERT INTO SubscriptionPlans (Name, PriceMonthly, MaxUsers, MaxPatients, Features)
    VALUES ('Starter', 29.00, 5, 500, '["appointments","billing"]')
  `);
  await pool.request().query(`
    INSERT INTO SubscriptionPlans (Name, PriceMonthly, MaxUsers, MaxPatients, Features)
    VALUES ('Enterprise', 249.00, NULL, NULL, '["appointments","billing","reports","lab","api"]')
  `);

  console.log("Seeding super admin...");
  const superAdminHash = await hashPassword(env.seed.superAdminPassword);
  await pool
    .request()
    .input("username", sql.NVarChar, env.seed.superAdminUsername)
    .input("passwordHash", sql.NVarChar, superAdminHash)
    .input("email", sql.NVarChar, env.seed.superAdminEmail)
    .query(`
      INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName, Email)
      VALUES (NULL, @username, @passwordHash, 'SUPER_ADMIN', 'Platform Super Admin', @email)
    `);

  console.log("Seeding demo clinic...");
  const clinicResult = await pool
    .request()
    .input("planId", sql.UniqueIdentifier, planId)
    .query<{ ClinicID: string }>(`
      INSERT INTO Clinics (ClinicName, Address, Phone, Email, Status, TimeZone, SubscriptionPlanID, SubscriptionExpiry, Settings)
      OUTPUT INSERTED.ClinicID
      VALUES (
        'Al-Shifa Family Clinic', 'Main Boulevard, Gulberg III, Lahore', '042-35123456', 'info@alshifaclinic.demo',
        'Approved', 'Asia/Karachi', @planId, DATEADD(YEAR, 1, SYSUTCDATETIME()),
        '{"mrNoFormat":"MR-{YYYY}-{seq}","tokenResetDaily":true}'
      )
    `);
  const clinicId = clinicResult.recordset[0].ClinicID;

  await pool
    .request()
    .input("clinicId", sql.UniqueIdentifier, clinicId)
    .input("planId", sql.UniqueIdentifier, planId)
    .query(`
      INSERT INTO ClinicSubscriptions (ClinicID, PlanID, Status, EndDate)
      VALUES (@clinicId, @planId, 'Active', DATEADD(YEAR, 1, SYSUTCDATETIME()))
    `);

  const demoHash = await hashPassword(env.seed.demoUserPassword);

  async function insertClinicUser(username: string, role: string, fullName: string, email: string): Promise<string> {
    const result = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("username", sql.NVarChar, username)
      .input("passwordHash", sql.NVarChar, demoHash)
      .input("role", sql.NVarChar, role)
      .input("fullName", sql.NVarChar, fullName)
      .input("email", sql.NVarChar, email)
      .query<{ UserID: string }>(`
        INSERT INTO Users (ClinicID, Username, PasswordHash, Role, FullName, Email)
        OUTPUT INSERTED.UserID
        VALUES (@clinicId, @username, @passwordHash, @role, @fullName, @email)
      `);
    return result.recordset[0].UserID;
  }

  console.log("Seeding clinic staff (one user per role)...");
  await insertClinicUser("clinicadmin", "CLINIC_ADMIN", "Sana Malik", "admin@alshifaclinic.demo");
  await insertClinicUser("receptionist", "RECEPTIONIST", "Hina Yousaf", "reception@alshifaclinic.demo");
  await insertClinicUser("nurse", "NURSE", "Nadia Aslam", "nurse@alshifaclinic.demo");

  console.log("Seeding doctors + schedules...");
  const doctorIds: string[] = [];
  for (const doc of DOCTORS) {
    const userId = await insertClinicUser(doc.username, "DOCTOR", doc.fullName, `${doc.username}@alshifaclinic.demo`);
    const doctorResult = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("userId", sql.UniqueIdentifier, userId)
      .input("doctorName", sql.NVarChar, doc.fullName)
      .input("specialization", sql.NVarChar, doc.specialization)
      .input("roomNo", sql.NVarChar, doc.roomNo)
      .query<{ DoctorID: string }>(`
        INSERT INTO Doctors (ClinicID, UserID, DoctorName, Specialization, ConsultationFee, FollowUpFee, RoomNo)
        OUTPUT INSERTED.DoctorID
        VALUES (@clinicId, @userId, @doctorName, @specialization, 1500.00, 800.00, @roomNo)
      `);
    const doctorId = doctorResult.recordset[0].DoctorID;
    doctorIds.push(doctorId);

    for (let day = 1; day <= 5; day++) {
      await pool
        .request()
        .input("clinicId", sql.UniqueIdentifier, clinicId)
        .input("doctorId", sql.UniqueIdentifier, doctorId)
        .input("dayOfWeek", sql.TinyInt, day)
        .query(`
          INSERT INTO DoctorSchedules (ClinicID, DoctorID, DayOfWeek, StartTime, EndTime, SlotDurationMinutes, MaxTokens)
          VALUES (@clinicId, @doctorId, @dayOfWeek, '09:00', '17:00', 15, 40)
        `);
    }
  }

  console.log("Seeding sample patients...");
  const patientIds: string[] = [];
  let seq = 1;
  for (const p of PATIENTS) {
    const mrNo = `MR-2026-${String(seq).padStart(4, "0")}`;
    const result = await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("mrNo", sql.NVarChar, mrNo)
      .input("name", sql.NVarChar, p.name)
      .input("father", sql.NVarChar, p.father)
      .input("gender", sql.NVarChar, p.gender)
      .input("dob", sql.Date, p.dob)
      .input("mobile", sql.NVarChar, p.mobile)
      .input("cnic", sql.NVarChar, p.cnic)
      .input("category", sql.NVarChar, p.category)
      .query<{ PatientID: string }>(`
        INSERT INTO Patients (ClinicID, MRNo, PatientName, FatherHusbandName, Gender, ActualDOB, MobileNo, CNIC, Category, Address)
        OUTPUT INSERTED.PatientID
        VALUES (@clinicId, @mrNo, @name, @father, @gender, @dob, @mobile, @cnic, @category, 'Lahore, Pakistan')
      `);
    patientIds.push(result.recordset[0].PatientID);
    seq++;
  }

  console.log("Seeding today's appointments...");
  for (let i = 0; i < patientIds.length; i++) {
    const doctorId = doctorIds[i % doctorIds.length];
    const tokenNo = Math.floor(i / doctorIds.length) + 1;
    const hour = 9 + Math.floor(i / doctorIds.length);
    await pool
      .request()
      .input("clinicId", sql.UniqueIdentifier, clinicId)
      .input("patientId", sql.UniqueIdentifier, patientIds[i])
      .input("doctorId", sql.UniqueIdentifier, doctorId)
      .input("tokenNo", sql.Int, tokenNo)
      .input("time", sql.VarChar, `${String(hour).padStart(2, "0")}:00`)
      .query(`
        INSERT INTO Appointments (ClinicID, PatientID, DoctorID, AppointmentDate, AppointmentTime, VisitType, TokenNo, Status)
        VALUES (@clinicId, @patientId, @doctorId, CAST(SYSUTCDATETIME() AS DATE), @time, 'Private', @tokenNo, 'Scheduled')
      `);
  }

  console.log("\nSeed complete. Demo logins (password shown is shared across all demo users):");
  console.log(`  Super Admin:   ${env.seed.superAdminUsername} / ${env.seed.superAdminPassword}`);
  console.log(`  Clinic Admin:  clinicadmin / ${env.seed.demoUserPassword}`);
  console.log(`  Doctor:        dr.ahmed / ${env.seed.demoUserPassword}`);
  console.log(`  Doctor:        dr.fatima / ${env.seed.demoUserPassword}`);
  console.log(`  Receptionist:  receptionist / ${env.seed.demoUserPassword}`);
  console.log(`  Nurse:         nurse / ${env.seed.demoUserPassword}`);

  await closePool();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
