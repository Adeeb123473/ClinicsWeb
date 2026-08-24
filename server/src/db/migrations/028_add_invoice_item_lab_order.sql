-- Links an invoice line back to the lab order it charges for, so a doctor-ordered test can be
-- billed exactly once. Nullable: ordinary lines (consultation fees, walk-in lab sales that were
-- never ordered, sundries) carry no lab order.
ALTER TABLE InvoiceItems ADD LabOrderID UNIQUEIDENTIFIER NULL;
GO

ALTER TABLE InvoiceItems ADD CONSTRAINT FK_InvoiceItems_LabOrder
  FOREIGN KEY (LabOrderID) REFERENCES LabOrders(LabOrderID);
GO

-- Deliberately NOT unique: voiding an invoice must free its lab orders to be re-billed, so
-- "already billed" is defined as "on a non-Void invoice" and enforced in the billing service.
CREATE INDEX IX_InvoiceItems_LabOrderID ON InvoiceItems(LabOrderID) WHERE LabOrderID IS NOT NULL;
