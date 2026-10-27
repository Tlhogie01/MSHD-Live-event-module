-- Run once against the existing mshd_events database.
ALTER TABLE events
  ADD COLUMN ticket_price DECIMAL(10,2) NULL AFTER pass_type;
