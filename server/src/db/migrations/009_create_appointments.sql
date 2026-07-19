CREATE TABLE Appointments (
  AppointmentID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicID UNIQUEIDENTIFIER NOT NULL,
  PatientID UNIQUEIDENTIFIER NOT NULL,
  DoctorID UNIQUEIDENTIFIER NOT NULL,
  MRNo NVARCHAR(50) NULL,
  AppointmentDate DATE NOT NULL,
  AppointmentTime TIME NOT NULL,
  VisitType NVARCHAR(20) NOT NULL DEFAULT 'Private',
  TokenNo INT NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'Scheduled',
  Remarks NVARCHAR(500) NULL,
  CreatedBy UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedBy UNIQUEIDENTIFIER NULL,
  UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Appointments_VisitType CHECK (VisitType IN ('Deserving','Private','FollowUp','Emergency','Insurance')),
  CONSTRAINT CK_Appointments_Status CHECK (Status IN ('Scheduled','CheckedIn','InConsultation','Completed','Cancelled','NoShow')),
  CONSTRAINT UQ_Appointments_Doctor_Date_Token UNIQUE (ClinicID, DoctorID, AppointmentDate, TokenNo),
  CONSTRAINT FK_Appointments_Clinic FOREIGN KEY (ClinicID) REFERENCES Clinics(ClinicID),
  CONSTRAINT FK_Appointments_Patient FOREIGN KEY (PatientID) REFERENCES Patients(PatientID),
  CONSTRAINT FK_Appointments_Doctor FOREIGN KEY (DoctorID) REFERENCES Doctors(DoctorID),
  CONSTRAINT FK_Appointments_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID),
  CONSTRAINT FK_Appointments_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES Users(UserID)
);
GO

CREATE INDEX IX_Appointments_Clinic_Date_Doctor ON Appointments(ClinicID, AppointmentDate, DoctorID);
CREATE INDEX IX_Appointments_Clinic_Patient ON Appointments(ClinicID, PatientID);
