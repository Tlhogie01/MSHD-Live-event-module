-- Run once against the existing mshd_events database.
-- Existing orders have already reserved inventory under the previous checkout flow,
-- so default those rows to 1. New pending orders explicitly use 0 and only reduce
-- available_quantity after PayFast confirms payment.
ALTER TABLE ticket_orders
  ADD COLUMN inventory_decremented TINYINT(1) NOT NULL DEFAULT 1 AFTER payment_status;
