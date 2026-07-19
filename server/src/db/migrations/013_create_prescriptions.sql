CREATE TABLE Prescriptions (
  PrescriptionID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicID UNIQUEIDENTIFIER NOT NULL,
  ConsultationID UNIQUEIDENTIFIER NOT NULL,
  IsDeleted BIT NOT NULL DEFAULT 0,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Prescriptions_Clinic FOREIGN KEY (ClinicID) REFERENCES Clinics(ClinicID),
  CONSTRAINT FK_Prescriptions_Consultation FOREIGN KEY (ConsultationID) REFERENCES Consultations(ConsultationID)
);
GO

CREATE INDEX IX_Prescriptions_Clinic_Consultation ON Prescriptions(ClinicID, ConsultationID);
