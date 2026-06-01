<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método no permitido']);
    exit;
}

require_once __DIR__ . '/../config.php';

try {
    $input = json_decode(file_get_contents('php://input'), true);

    $date     = trim($input['date']     ?? '');
    $hour     = (int)($input['hour']     ?? -1);
    $duration = (int)($input['duration'] ?? 1);
    $name     = trim($input['name']     ?? '');
    $phone    = trim($input['phone']    ?? '');
    $email    = trim($input['email']    ?? '');
    $service  = trim($input['service']  ?? '');

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        echo json_encode(['success' => false, 'message' => 'Fecha inválida']);
        exit;
    }
    if ($hour < 8 || $hour > 17 || !in_array($duration, [1, 2])) {
        echo json_encode(['success' => false, 'message' => 'Horario fuera de rango']);
        exit;
    }
    if (!$name || !$phone) {
        echo json_encode(['success' => false, 'message' => 'Nombre y teléfono son obligatorios']);
        exit;
    }

    $db = getDB();

    // Verificar disponibilidad (evita condición de carrera)
    $stmt = $db->prepare(
        'SELECT COUNT(*) FROM appointments
         WHERE date = ? AND hour < ? AND (hour + duration) > ?'
    );
    $stmt->execute([$date, $hour + $duration, $hour]);

    if ($stmt->fetchColumn() > 0) {
        echo json_encode(['success' => false, 'message' => 'Ese horario ya fue reservado. Elige otro.']);
        exit;
    }

    // Insertar cita
    $stmt = $db->prepare(
        'INSERT INTO appointments (date, hour, duration, name, phone, email, service)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$date, $hour, $duration, $name, $phone, $email ?: null, $service ?: null]);

    echo json_encode(['success' => true, 'message' => 'Cita registrada correctamente']);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error de base de datos: ' . $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Error del servidor: ' . $e->getMessage()]);
}
