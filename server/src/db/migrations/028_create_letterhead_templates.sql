-- Per-doctor letterhead templates for printing prescriptions/slips onto pre-printed pads
-- (OVERLAY) or onto plain paper with the letterhead rendered by us (FULL).
--
-- All field coordinates are millimetres from the top-left of the physical page. Paper is
-- always A4, but the size is stored rather than assumed so a future paper size does not
-- require a data migration.
CREATE TABLE LetterheadTemplates (
  LetterheadTemplateID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicID UNIQUEIDENTIFIER NOT NULL,
  DoctorID UNIQUEIDENTIFIER NOT NULL,
  Mode NVARCHAR(10) NOT NULL DEFAULT 'OVERLAY',
  PaperSize NVARCHAR(10) NOT NULL DEFAULT 'A4',
  PaperWidthMm DECIMAL(7,2) NOT NULL DEFAULT 210,
  PaperHeightMm DECIMAL(7,2) NOT NULL DEFAULT 297,
  -- The four source-image points used for the perspective transform, as JSON [{x,y} x4] in
  -- ORIGINAL image pixels. Retained so the crop stays reproducible and re-editable.
  CornerPoints NVARCHAR(MAX) NULL,
  -- Calibration of the dewarped image: exact and constant, derived from the paper size and
  -- the fixed 200dpi output resolution.
  ImageWidthPx INT NULL,
  ImageHeightPx INT NULL,
  MmPerPx DECIMAL(12,8) NULL,
  -- Single knob shifting the whole printed page, set from a test print.
  GlobalOffsetXMm DECIMAL(7,2) NOT NULL DEFAULT 0,
  GlobalOffsetYMm DECIMAL(7,2) NOT NULL DEFAULT 0,
  -- CALIBRATED only once the doctor has confirmed a successful test print.
  Status NVARCHAR(12) NOT NULL DEFAULT 'DRAFT',
  -- Array of field placements; see letterheads.schemas.ts for the shape. JSON matches the
  -- existing convention for structured settings (Clinics.Settings, Clinics.OperatingHours).
  Fields NVARCHAR(MAX) NOT NULL DEFAULT '[]',
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CreatedBy UNIQUEIDENTIFIER NULL,
  UpdatedAt DATETIME2 NULL,
  UpdatedBy UNIQUEIDENTIFIER NULL,
  CONSTRAINT CK_LetterheadTemplates_Mode CHECK (Mode IN ('OVERLAY','FULL')),
  CONSTRAINT CK_LetterheadTemplates_Status CHECK (Status IN ('DRAFT','CALIBRATED')),
  -- One template per doctor keeps lookup unambiguous at print time.
  CONSTRAINT UQ_LetterheadTemplates_Doctor UNIQUE (DoctorID),
  CONSTRAINT FK_LetterheadTemplates_Clinic FOREIGN KEY (ClinicID) REFERENCES Clinics(ClinicID),
  CONSTRAINT FK_LetterheadTemplates_Doctor FOREIGN KEY (DoctorID) REFERENCES Doctors(DoctorID)
);
GO

CREATE INDEX IX_LetterheadTemplates_Clinic ON LetterheadTemplates(ClinicID);
GO

-- Images live in their own table so that reading a template (done on every print) never drags
-- a multi-megabyte blob along with it.
--
-- Bytes are stored in the database rather than on disk because the API runs on an ephemeral
-- filesystem: anything written to disk is lost on the next deploy, and there is no static file
-- serving configured. VARBINARY keeps the letterhead durable with no new infrastructure.
CREATE TABLE LetterheadImages (
  LetterheadImageID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  LetterheadTemplateID UNIQUEIDENTIFIER NOT NULL,
  -- ORIGINAL is the raw upload, kept so the crop can be redone without re-uploading.
  -- DEWARPED is the geometrically corrected image used as the editor backdrop, and in FULL
  -- mode as the printed page background.
  Kind NVARCHAR(10) NOT NULL,
  ContentType NVARCHAR(60) NOT NULL,
  Bytes VARBINARY(MAX) NOT NULL,
  WidthPx INT NULL,
  HeightPx INT NULL,
  SizeBytes INT NOT NULL,
  CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_LetterheadImages_Kind CHECK (Kind IN ('ORIGINAL','DEWARPED')),
  CONSTRAINT UQ_LetterheadImages_Template_Kind UNIQUE (LetterheadTemplateID, Kind),
  CONSTRAINT FK_LetterheadImages_Template FOREIGN KEY (LetterheadTemplateID)
    REFERENCES LetterheadTemplates(LetterheadTemplateID) ON DELETE CASCADE
);
