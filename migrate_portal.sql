-- Portal de pacientes — ejecutar UNA SOLA VEZ en phpMyAdmin › pestaña SQL

CREATE TABLE IF NOT EXISTS patient_users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  google_id  VARCHAR(128) UNIQUE NOT NULL,
  email      VARCHAR(120) NOT NULL,
  name       VARCHAR(120),
  picture    VARCHAR(500),
  phone      VARCHAR(20),
  birth_date DATE,
  notes      TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routines (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  patient_id  INT NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  status      ENUM('activa','pausada','completada') DEFAULT 'activa',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patient_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  routine_id       INT NOT NULL,
  name             VARCHAR(200) NOT NULL,
  description      TEXT,
  sets             INT,
  reps             INT,
  duration_seconds INT,
  video_url        VARCHAR(500),
  sort_order       INT DEFAULT 0,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);
