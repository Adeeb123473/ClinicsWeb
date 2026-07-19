CREATE TABLE ClinicSubscriptions (
  ClinicSubscriptionID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicID UNIQUEIDENTIFIER NOT NULL,
  PlanID UNIQUEIDENTIFIER NOT NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'Active',
  StartDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  EndDate DATETIME2 NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_ClinicSubscriptions_Status CHECK (Status IN ('Active','Expired','Cancelled','GracePeriod')),
  CONSTRAINT FK_ClinicSubscriptions_Clinic FOREIGN KEY (ClinicID) REFERENCES Clinics(ClinicID),
  CONSTRAINT FK_ClinicSubscriptions_Plan FOREIGN KEY (PlanID) REFERENCES SubscriptionPlans(PlanID)
);
GO

CREATE INDEX IX_ClinicSubscriptions_ClinicID ON ClinicSubscriptions(ClinicID);
