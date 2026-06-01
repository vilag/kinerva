-- Ejecuta este archivo una sola vez en phpMyAdmin (pestaña SQL)
-- para crear la base de datos y la tabla de citas.

CREATE DATABASE IF NOT EXISTS kinerva
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_spanish_ci;

USE kinerva;

CREATE TABLE IF NOT EXISTS appointments (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    date        DATE            NOT NULL                    COMMENT 'Fecha de la cita (YYYY-MM-DD)',
    hour        TINYINT UNSIGNED NOT NULL                  COMMENT 'Hora de inicio 8–17',
    duration    TINYINT UNSIGNED NOT NULL DEFAULT 1        COMMENT 'Duración en horas (1 ó 2)',
    name        VARCHAR(120)    NOT NULL,
    phone       VARCHAR(25)     NOT NULL,
    email       VARCHAR(120)    DEFAULT NULL,
    service     VARCHAR(100)    DEFAULT NULL,
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
