CREATE TABLE Clinics (
  ClinicID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicName NVARCHAR(255) NOT NULL,
  Address NVARCHAR(500) NULL,
  Phone NVARCHAR(50) NULL,
  Email NVARCHAR(255) NULL,
  LogoUrl NVARCHAR(500) NULL,
  Status NVARCHAR(20) NOT NULL DEFAULT 'Pending',
  OperatingHours NVARCHAR(MAX) NULL,
  TimeZone NVARCHAR(100) NOT NULL DEFAULT 'Asia/Karachi',
  Settings NVARCHAR(MAX) NULL,
  SubscriptionPlanID UNIQUEIDENTIFIER NULL,
  SubscriptionExpiry DATETIME2 NULL,
  CreatedDate DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Clinics_Status CHECK (Status IN ('Pending','Approved','Suspended','Inactive')),
  CONSTRAINT CK_Clinics_OperatingHours_Json CHECK (OperatingHours IS NULL OR ISJSON(OperatingHours) = 1),
  CONSTRAINT CK_Clinics_Settings_Json CHECK (Settings IS NULL OR ISJSON(Settings) = 1),
  CONSTRAINT FK_Clinics_SubscriptionPlan FOREIGN KEY (SubscriptionPlanID) REFERENCES SubscriptionPlans(PlanID)
);
GO

CREATE INDEX IX_Clinics_Status ON Clinics(Status);
