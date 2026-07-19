-- Platform-level settings (single row, JSON blob) and announcements shown to clinics.

CREATE TABLE PlatformSettings (
  Id INT NOT NULL PRIMARY KEY DEFAULT 1,
  Settings NVARCHAR(MAX) NOT NULL,
  UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedBy UNIQUEIDENTIFIER NULL,
  CONSTRAINT CK_PlatformSettings_Single CHECK (Id = 1),
  CONSTRAINT CK_PlatformSettings_Json CHECK (ISJSON(Settings) = 1),
  CONSTRAINT FK_PlatformSettings_UpdatedBy FOREIGN KEY (UpdatedBy) REFERENCES Users(UserID)
);
GO

CREATE TABLE Announcements (
  AnnouncementID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  Title NVARCHAR(255) NOT NULL,
  Body NVARCHAR(2000) NULL,
  Level NVARCHAR(20) NOT NULL DEFAULT 'info',
  IsActive BIT NOT NULL DEFAULT 1,
  StartsAt DATETIME2 NULL,
  EndsAt DATETIME2 NULL,
  CreatedBy UNIQUEIDENTIFIER NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Announcements_Level CHECK (Level IN ('info','warning','critical')),
  CONSTRAINT FK_Announcements_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES Users(UserID)
);
GO

CREATE INDEX IX_Announcements_Active ON Announcements(IsActive);
