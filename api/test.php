<?php
// Endpoint de diagnóstico — ELIMINAR en producción
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$result = ['php' => PHP_VERSION, 'steps' => []];

// 1. ¿Existe config.php?
$configPath = __DIR__ . '/../config.php';
if (!file_exists($configPath)) {
    $result['steps'][] = ['config' => 'FAIL — config.php no encontrado'];
    echo json_encode($result);
    exit;
}
$result['steps'][] = ['config' => 'OK'];

require_once $configPath;

// 2. ¿Conecta a MySQL?
try {
    $db = getDB();
    $result['steps'][] = ['conexion_db' => 'OK'];
} catch (Throwable $e) {
    $result['steps'][] = ['conexion_db' => 'FAIL — ' . $e->getMessage()];
    echo json_encode($result);
    exit;
}

// 3. ¿Existe la tabla appointments?
try {
    $db->query('SELECT 1 FROM appointments LIMIT 1');
    $result['steps'][] = ['tabla_appointments' => 'OK'];
} catch (Throwable $e) {
    $result['steps'][] = ['tabla_appointments' => 'FAIL — ' . $e->getMessage() .
        ' → Ejecuta setup.sql en phpMyAdmin'];
    echo json_encode($result);
    exit;
}

// 4. Conteo de citas
$count = $db->query('SELECT COUNT(*) FROM appointments')->fetchColumn();
$result['steps'][] = ['citas_registradas' => (int) $count];
$result['status'] = 'TODO OK';

echo json_encode($result, JSON_PRETTY_PRINT);
