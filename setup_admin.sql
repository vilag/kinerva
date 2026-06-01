-- ============================================================
--  Kinerva — tablas del panel de administración
--  Ejecutar UNA VEZ después de setup.sql
-- ============================================================
USE kinerva;

-- Nuevas columnas en appointments
ALTER TABLE appointments
    ADD COLUMN status     ENUM('pendiente','confirmada','completada','cancelada')
                          NOT NULL DEFAULT 'pendiente';
ALTER TABLE appointments
    ADD COLUMN patient_id INT UNSIGNED DEFAULT NULL;

-- Tabla de administradores
CREATE TABLE IF NOT EXISTS admins (
    id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50)     NOT NULL UNIQUE,
    password_hash VARCHAR(255)    NOT NULL,
    created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de pacientes
CREATE TABLE IF NOT EXISTS patients (
    id         INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(120)  NOT NULL,
    phone      VARCHAR(25)   NOT NULL UNIQUE,
    email      VARCHAR(120)  DEFAULT NULL,
    birth_date DATE          DEFAULT NULL,
    notes      TEXT          DEFAULT NULL,
    created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Notas clínicas por paciente
CREATE TABLE IF NOT EXISTS patient_notes (
    id         INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
    patient_id INT UNSIGNED  NOT NULL,
    content    TEXT          NOT NULL,
    created_by VARCHAR(50)   DEFAULT NULL,
    created_at TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrar pacientes existentes desde citas ya agendadas
INSERT IGNORE INTO patients (name, phone, email)
SELECT DISTINCT name, phone, NULLIF(email, '')
FROM   appointments;
