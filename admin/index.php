<?php
$pageTitle = 'Dashboard';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/includes/helpers.php';

$db = getDB();

$today      = date('Y-m-d');
$weekStart  = date('Y-m-d', strtotime('monday this week'));
$weekEnd    = date('Y-m-d', strtotime('sunday this week'));
$monthStart = date('Y-m-01');
$monthEnd   = date('Y-m-t');

$stats = [
    'today'    => cnt($db, 'SELECT COUNT(*) FROM appointments WHERE date = ?', [$today]),
    'week'     => cnt($db, 'SELECT COUNT(*) FROM appointments WHERE date BETWEEN ? AND ?', [$weekStart, $weekEnd]),
    'month'    => cnt($db, 'SELECT COUNT(*) FROM appointments WHERE date BETWEEN ? AND ?', [$monthStart, $monthEnd]),
    'patients' => cnt($db, 'SELECT COUNT(*) FROM patients'),
];

$todayAppts = $db->prepare(
    'SELECT a.*, p.id AS pid
     FROM appointments a
     LEFT JOIN patients p ON p.phone = a.phone
     WHERE a.date = ? ORDER BY a.hour'
);
$todayAppts->execute([$today]);
$appts = $todayAppts->fetchAll();

// Próximas citas (próximos 7 días, excluyendo hoy)
$upcoming = $db->prepare(
    'SELECT a.*, p.id AS pid
     FROM appointments a
     LEFT JOIN patients p ON p.phone = a.phone
     WHERE a.date > ? AND a.date <= DATE_ADD(?, INTERVAL 7 DAY)
       AND a.status NOT IN (\'cancelada\')
     ORDER BY a.date, a.hour LIMIT 10'
);
$upcoming->execute([$today, $today]);
$upcomingAppts = $upcoming->fetchAll();
?>
<?php require_once __DIR__ . '/includes/header.php'; ?>

<!-- Stats -->
<div class="row g-3 mb-4">
    <?php
    $cards = [
        ['today',    'Citas hoy',       'fas fa-calendar-day',  'i-teal'],
        ['week',     'Esta semana',      'fas fa-calendar-week', 'i-navy'],
        ['month',    'Este mes',         'fas fa-calendar-alt',  'i-green'],
        ['patients', 'Pacientes',        'fas fa-users',         'i-orange'],
    ];
    foreach ($cards as [$key, $label, $icon, $cls]):
    ?>
    <div class="col-6 col-xl-3">
        <div class="ak-stat">
            <div class="ak-stat-icon <?= $cls ?>"><i class="<?= $icon ?>"></i></div>
            <div>
                <div class="ak-stat-val"><?= $stats[$key] ?></div>
                <div class="ak-stat-lbl"><?= $label ?></div>
            </div>
        </div>
    </div>
    <?php endforeach; ?>
</div>

<!-- Hoy + Próximas -->
<div class="row g-3">
    <div class="col-12 col-xl-7">
        <div class="ak-card">
            <div class="ak-card-head">
                <h6><i class="fas fa-clock me-2" style="color:var(--ak-teal)"></i>
                    Citas de hoy &mdash; <?= date('d/m/Y') ?>
                </h6>
                <a href="appointments.php?date=<?= $today ?>" class="btn btn-sm btn-ak">Ver todas</a>
            </div>
            <?php if (empty($appts)): ?>
            <div class="ak-card-body text-center text-muted py-5">
                <i class="fas fa-calendar-times fa-2x mb-3 d-block" style="opacity:.25"></i>
                Sin citas para hoy
            </div>
            <?php else: ?>
            <div class="table-responsive">
                <table class="ak-tbl">
                    <thead><tr>
                        <th>Hora</th><th>Paciente</th><th>Servicio</th><th>Dur.</th><th>Estado</th>
                    </tr></thead>
                    <tbody>
                    <?php foreach ($appts as $a): ?>
                    <tr>
                        <td><strong><?= fmtHour((int)$a['hour']) ?></strong></td>
                        <td>
                            <a href="patient_detail.php?phone=<?= urlencode($a['phone']) ?>"
                               class="text-decoration-none fw-semibold">
                                <?= h($a['name']) ?>
                            </a><br>
                            <small class="text-muted"><?= h($a['phone']) ?></small>
                        </td>
                        <td><?= h($a['service'] ?: 'Evaluación') ?></td>
                        <td><?= $a['duration'] ?>h</td>
                        <td><?= statusBadge($a['status'] ?? 'pendiente') ?></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endif; ?>
        </div>
    </div>

    <div class="col-12 col-xl-5">
        <div class="ak-card">
            <div class="ak-card-head">
                <h6><i class="fas fa-forward me-2" style="color:var(--ak-teal)"></i>Próximos 7 días</h6>
            </div>
            <?php if (empty($upcomingAppts)): ?>
            <div class="ak-card-body text-center text-muted py-4" style="font-size:13px">
                Sin citas próximas
            </div>
            <?php else: ?>
            <div class="table-responsive">
                <table class="ak-tbl">
                    <thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Estado</th></tr></thead>
                    <tbody>
                    <?php foreach ($upcomingAppts as $a): ?>
                    <tr>
                        <td><?= date('d/m', strtotime($a['date'])) ?></td>
                        <td><?= fmtHour((int)$a['hour']) ?></td>
                        <td>
                            <a href="patient_detail.php?phone=<?= urlencode($a['phone']) ?>"
                               class="text-decoration-none"><?= h($a['name']) ?></a>
                        </td>
                        <td><?= statusBadge($a['status'] ?? 'pendiente') ?></td>
                    </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endif; ?>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
