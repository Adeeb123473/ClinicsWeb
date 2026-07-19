CREATE TABLE Payments (
  PaymentID UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
  ClinicID UNIQUEIDENTIFIER NOT NULL,
  InvoiceID UNIQUEIDENTIFIER NOT NULL,
  Amount DECIMAL(12,2) NOT NULL,
  PaymentMethod NVARCHAR(30) NOT NULL DEFAULT 'Cash',
  ReceivedByUserID UNIQUEIDENTIFIER NULL,
  PaidAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT CK_Payments_Method CHECK (PaymentMethod IN ('Cash','Card','BankTransfer','Insurance','Other')),
  CONSTRAINT FK_Payments_Clinic FOREIGN KEY (ClinicID) REFERENCES Clinics(ClinicID),
  CONSTRAINT FK_Payments_Invoice FOREIGN KEY (InvoiceID) REFERENCES Invoices(InvoiceID),
  CONSTRAINT FK_Payments_ReceivedBy FOREIGN KEY (ReceivedByUserID) REFERENCES Users(UserID)
);
GO

CREATE INDEX IX_Payments_Clinic_Invoice ON Payments(ClinicID, InvoiceID);
