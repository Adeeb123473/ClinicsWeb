CREATE TABLE Consultations (
  ConsultationID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicID UNIQUEIDENTIFIER NOT NULL,
  AppointmentID UNIQUEIDENTIFIER NOT NULL,
  PatientID UNIQUEIDENTIFIER NOT NULL,
  DoctorID UNIQUEIDENTIFIER NOT NULL,
  ChiefComplaint NVARCHAR(1000) NULL,
  HistoryOfPresentIllness NVARCHAR(MAX) NULL,
  ExaminationNotes NVARCHAR(MAX) NULL,
  Diagnosis NVARCHAR(1000) NULL,
  ICD10Code NVARCHAR(20) NULL,
  TreatmentPlan NVARCHAR(MAX) NULL,
  FollowUpDate DATE NULL,
  IsDeleted BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_Consultations_AppointmentID UNIQUE (AppointmentID),
  CONSTRAINT FK_Consultations_Clinic FOREIGN KEY (ClinicID) REFERENCES Clinics(ClinicID),
  CONSTRAINT FK_Consultations_Appointment FOREIGN KEY (AppointmentID) REFERENCES Appointments(AppointmentID),
  CONSTRAINT FK_Consultations_Patient FOREIGN KEY (PatientID) REFERENCES Patients(PatientID),
  CONSTRAINT FK_Consultations_Doctor FOREIGN KEY (DoctorID) REFERENCES Doctors(DoctorID)
);
GO

CREATE INDEX IX_Consultations_Clinic_Patient ON Consultations(ClinicID, PatientID);
CREATE INDEX IX_Consultations_Clinic_Doctor ON Consultations(ClinicID, DoctorID);
