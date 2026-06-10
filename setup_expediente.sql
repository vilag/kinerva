-- ============================================================
--  Kinerva — tabla para secciones del expediente clínico
--  Ejecutar en phpMyAdmin (Hostinger) sobre la base de datos
--  u690371019_kinerva
-- ============================================================

CREATE TABLE IF NOT EXISTS expediente_config (
    folio      VARCHAR(20)  NOT NULL DEFAULT 'borrador',
    section    VARCHAR(50)  NOT NULL,
    data       MEDIUMTEXT   NOT NULL,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (folio, section),
    INDEX idx_folio   (folio),
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
