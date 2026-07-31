-- Permanent agent block support.
-- Extends agents.status with 'blocked' and stores why / when / who.
USE real_estate;

ALTER TABLE agents
  MODIFY COLUMN status ENUM(
    'pending','approved','rejected','disabled','blocked'
  ) NOT NULL DEFAULT 'approved';

ALTER TABLE agents
  ADD COLUMN blocked_reason TEXT NULL AFTER status,
  ADD COLUMN blocked_at DATETIME NULL AFTER blocked_reason,
  ADD COLUMN blocked_by VARCHAR(100) NULL AFTER blocked_at;

INSERT INTO schema_migrations (id) VALUES ('005_agent_block')
ON DUPLICATE KEY UPDATE applied_at = applied_at;
