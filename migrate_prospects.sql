-- Migración: crea tabla de prospectos del formulario rápido
-- Ejecutar una sola vez en phpMyAdmin → pestaña SQL

CREATE TABLE IF NOT EXISTS prospects (
    id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120)    NOT NULL,
    phone       VARCHAR(25)     NOT NULL,
    service     VARCHAR(100)    DEFAULT NULL,
    status      ENUM('nuevo','contactado','convertido','descartado') NOT NULL DEFAULT 'nuevo',
    created_at  TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
