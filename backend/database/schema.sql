CREATE DATABASE IF NOT EXISTS mshd_events
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE mshd_events;

CREATE TABLE IF NOT EXISTS admins (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(180) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  pass_type ENUM('FREE', 'TICKETED') NOT NULL,
  ticket_price DECIMAL(10,2) NULL,
  event_logo_path VARCHAR(500) NULL,
  feature_photo_path VARCHAR(500) NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  venue VARCHAR(255) NOT NULL,
  status ENUM('DRAFT', 'PUBLISHED', 'UNPUBLISHED', 'CANCELLED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_events_status_date (status, event_date),
  KEY idx_events_deleted_at (deleted_at),
  CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS event_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  available_quantity INT UNSIGNED NOT NULL,
  sale_start DATETIME NULL,
  sale_end DATETIME NULL,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_event_tickets_event (event_id),
  CONSTRAINT fk_event_tickets_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT chk_ticket_price CHECK (price >= 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS event_media (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  media_type ENUM('PHOTO', 'VIDEO') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  KEY idx_event_media_event_type (event_id, media_type, deleted_at),
  CONSTRAINT fk_event_media_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  ticket_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  inventory_decremented TINYINT(1) NOT NULL DEFAULT 1,
  order_reference VARCHAR(80) NOT NULL,
  customer_name VARCHAR(180) NOT NULL,
  customer_email VARCHAR(254) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id), UNIQUE KEY uq_ticket_orders_reference (order_reference),
  KEY idx_ticket_orders_event (event_id),
  CONSTRAINT fk_ticket_orders_event FOREIGN KEY (event_id) REFERENCES events(id),
  CONSTRAINT fk_ticket_orders_ticket FOREIGN KEY (ticket_id) REFERENCES event_tickets(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS issued_tickets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  event_id BIGINT UNSIGNED NOT NULL,
  ticket_id BIGINT UNSIGNED NOT NULL,
  ticket_number VARCHAR(100) NOT NULL,
  qr_code TEXT NULL,
  status ENUM('VALID', 'USED', 'CANCELLED', 'REFUNDED') NOT NULL DEFAULT 'VALID',
  issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_issued_tickets_number (ticket_number),
  KEY idx_issued_tickets_order (order_id),
  CONSTRAINT fk_issued_tickets_order FOREIGN KEY (order_id) REFERENCES ticket_orders(id),
  CONSTRAINT fk_issued_tickets_event FOREIGN KEY (event_id) REFERENCES events(id),
  CONSTRAINT fk_issued_tickets_ticket FOREIGN KEY (ticket_id) REFERENCES event_tickets(id)
) ENGINE=InnoDB;
