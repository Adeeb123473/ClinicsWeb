CREATE TABLE PrescriptionItems (
  PrescriptionItemID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  PrescriptionID UNIQUEIDENTIFIER NOT NULL,
  MedicineName NVARCHAR(255) NOT NULL,
  Dosage NVARCHAR(100) NULL,
  Frequency NVARCHAR(100) NULL,
  DurationDays INT NULL,
  Instructions NVARCHAR(500) NULL,
  SortOrder INT NOT NULL DEFAULT 0,
  CONSTRAINT FK_PrescriptionItems_Prescription FOREIGN KEY (PrescriptionID) REFERENCES Prescriptions(PrescriptionID)
);
GO

CREATE INDEX IX_PrescriptionItems_PrescriptionID ON PrescriptionItems(PrescriptionID);
