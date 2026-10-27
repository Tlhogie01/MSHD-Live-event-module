-- Run once against the existing mshd_events database.
ALTER TABLE events
  ADD COLUMN event_logo_path VARCHAR(500) NULL AFTER ticket_price;
