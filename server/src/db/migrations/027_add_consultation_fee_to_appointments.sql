-- NULL means "use the doctor's standard fee at billing time"; reception can override the
-- fee for a specific visit at the time of booking.
ALTER TABLE Appointments ADD ConsultationFee DECIMAL(10,2) NULL;
