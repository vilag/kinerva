<?php
// Credenciales de conexión — ajusta según tu entorno XAMPP/WAMP
define('DB_HOST', 'srv467.hstgr.io');
define('DB_USER', 'u690371019_kinerva');
define('DB_PASS', 'BnWgtegyo2G>');          // En XAMPP la contraseña por defecto es vacía
define('DB_NAME', 'u690371019_kinerva');

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}
