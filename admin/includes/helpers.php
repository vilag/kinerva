<?php
function fmtHour(int $h): string {
    if ($h < 12) return "{$h}:00 AM";
    if ($h === 12) return '12:00 PM';
    return ($h - 12) . ':00 PM';
}

function statusBadge(string $s): string {
    $map = [
        'pendiente'  => ['Pendiente',  'bs-pendiente'],
        'confirmada' => ['Confirmada', 'bs-confirmada'],
        'completada' => ['Completada', 'bs-completada'],
        'cancelada'  => ['Cancelada',  'bs-cancelada'],
    ];
    [$lbl, $cls] = $map[$s] ?? [$s, ''];
    return "<span class='bs {$cls}'>" . htmlspecialchars($lbl) . '</span>';
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function cnt(PDO $db, string $sql, array $p = []): int {
    $st = $db->prepare($sql);
    $st->execute($p);
    return (int) $st->fetchColumn();
}
