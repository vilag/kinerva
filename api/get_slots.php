<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/../config.php';

try {
    $year  = filter_input(INPUT_GET, 'year',  FILTER_VALIDATE_INT);
    $month = filter_input(INPUT_GET, 'month', FILTER_VALIDATE_INT);

    if (!$year || !$month || $month < 1 || $month > 12) {
        echo json_encode(['slots' => [], 'error' => 'Parámetros inválidos']);
        exit;
    }

    $start = sprintf('%04d-%02d-01', $year, $month);
    $end   = date('Y-m-t', strtotime($start));

    $stmt = getDB()->prepare(
        'SELECT date, hour, duration
         FROM appointments
         WHERE date BETWEEN ? AND ?
         ORDER BY date, hour'
    );
    $stmt->execute([$start, $end]);

    $slots = array_map(function ($row) {
        return [
            'date'     => $row['date'],
            'hour'     => (int) $row['hour'],
            'duration' => (int) $row['duration'],
        ];
    }, $stmt->fetchAll());

    echo json_encode(['slots' => $slots]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['slots' => [], 'error' => 'DB: ' . $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['slots' => [], 'error' => $e->getMessage()]);
}
