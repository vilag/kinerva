-- Migración v2: agrega email, notes y source a prospects
-- Ejecutar una sola vez en phpMyAdmin → pestaña SQL

ALTER TABLE prospects
  ADD COLUMN email  VARCHAR(120) DEFAULT NULL AFTER phone,
  ADD COLUMN notes  TEXT         DEFAULT NULL AFTER service,
  ADD COLUMN source VARCHAR(60)  DEFAULT NULL AFTER notes;
