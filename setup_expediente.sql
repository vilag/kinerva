-- ============================================================
--  Kinerva — expediente clínico
--  Ejecutar en phpMyAdmin sobre la base de datos u690371019_kinerva
-- ============================================================

-- Tabla principal de secciones del expediente
CREATE TABLE IF NOT EXISTS expediente_config (
    folio      VARCHAR(20)  NOT NULL DEFAULT 'borrador',
    section    VARCHAR(50)  NOT NULL,
    data       MEDIUMTEXT   NOT NULL,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (folio, section),
    INDEX idx_folio   (folio),
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Registro de auditoría de expedientes eliminados
CREATE TABLE IF NOT EXISTS expedientes_eliminados (
    id         INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
    folio      VARCHAR(20)  NOT NULL,
    data_json  LONGTEXT     NOT NULL,
    deleted_by VARCHAR(100) DEFAULT 'admin',
    deleted_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_folio     (folio),
    INDEX idx_deleted   (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
