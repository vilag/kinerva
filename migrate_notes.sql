-- Migración: agrega columna notes a appointments
-- Ejecutar una sola vez en phpMyAdmin → pestaña SQL

ALTER TABLE appointments
  ADD COLUMN notes TEXT DEFAULT NULL
  AFTER service;
