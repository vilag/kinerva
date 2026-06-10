-- ============================================================
--  Kinerva — tabla para secciones del expediente clínico
--  Ejecutar en phpMyAdmin (Hostinger) sobre la base de datos
--  u690371019_kinerva, o localmente:
--    docker exec -i kinerva_db mysql -u kinerva -pkinervapass kinerva < setup_expediente.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS expediente_config (
    section    VARCHAR(50)  NOT NULL PRIMARY KEY,
    data       MEDIUMTEXT   NOT NULL,
    updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
