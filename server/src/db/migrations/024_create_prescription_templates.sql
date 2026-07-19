CREATE TABLE PrescriptionTemplates (
  TemplateID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicID UNIQUEIDENTIFIER NOT NULL,
  DoctorID UNIQUEIDENTIFIER NOT NULL,
  Name NVARCHAR(255) NOT NULL,
  Items NVARCHAR(MAX) NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_PrescriptionTemplates_Items_Json CHECK (ISJSON(Items) = 1),
  CONSTRAINT FK_PrescriptionTemplates_Clinic FOREIGN KEY (ClinicID) REFERENCES Clinics(ClinicID),
  CONSTRAINT FK_PrescriptionTemplates_Doctor FOREIGN KEY (DoctorID) REFERENCES Doctors(DoctorID)
);
GO

CREATE INDEX IX_PrescriptionTemplates_Doctor ON PrescriptionTemplates(ClinicID, DoctorID);
