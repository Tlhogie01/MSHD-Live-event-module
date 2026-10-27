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

SET @has_created_by = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND COLUMN_NAME = 'created_by'
);
SET @add_created_by = IF(
  @has_created_by = 0,
  'ALTER TABLE events ADD COLUMN created_by BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE add_created_by_stmt FROM @add_created_by;
EXECUTE add_created_by_stmt;
DEALLOCATE PREPARE add_created_by_stmt;

SET @has_admin_fk = (
  SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'events' AND CONSTRAINT_NAME = 'fk_events_created_by'
);
SET @add_admin_fk = IF(
  @has_admin_fk = 0,
  'ALTER TABLE events ADD CONSTRAINT fk_events_created_by FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE add_admin_fk_stmt FROM @add_admin_fk;
EXECUTE add_admin_fk_stmt;
DEALLOCATE PREPARE add_admin_fk_stmt;
