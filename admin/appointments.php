<?php
$pageTitle = 'Citas';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/includes/helpers.php';
$db = getDB();

// ── Actualizar estado ──────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['update_status'])) {
    $id     = (int)($_POST['id'] ?? 0);
    $status = $_POST['status'] ?? '';
    if ($id > 0 && in_array($status, ['pendiente','confirmada','completada','cancelada'])) {
        $db->prepare('UPDATE appointments SET status=? WHERE id=?')->execute([$status, $id]);
    }
    $qs = http_build_query(array_filter(['date'=>$_GET['date']??'', 'status'=>$_GET['status']??'']));
    header('Location: appointments.php' . ($qs ? "?$qs" : ''));
    exit;
}

// ── Filtros ────────────────────────────────────────────────────────────────
$filterDate   = $_GET['date']   ?? '';
$filterStatus = $_GET['status'] ?? '';

$where  = ['1=1'];
$params = [];

if ($filterDate) {
    $where[]  = 'a.date = ?';
    $params[] = $filterDate;
} else {
    $where[]  = 'a.date >= CURDATE()';
}
if ($filterStatus) {
    $where[]  = 'a.status = ?';
    $params[] = $filterStatus;
}

$sql = 'SELECT a.*, p.id AS pid
        FROM appointments a
        LEFT JOIN patients p ON p.phone = a.phone
        WHERE ' . implode(' AND ', $where) . '
        ORDER BY a.date, a.hour
        LIMIT 200';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();
?>
<?php require_once __DIR__ . '/includes/header.php'; ?>

<!-- Filtros -->
<div class="ak-card mb-3">
    <div class="ak-card-body">
        <form method="GET" class="row g-2 align-items-end">
            <div class="col-sm-4 col-md-3">
                <label class="form-label" style="font-size:12px;font-weight:600">Fecha</label>
                <input type="date" name="date" class="form-control form-control-sm"
                       value="<?= h($filterDate) ?>">
            </div>
            <div class="col-sm-4 col-md-3">
                <label class="form-label" style="font-size:12px;font-weight:600">Estado</label>
                <select name="status" class="form-select form-select-sm">
                    <option value="">Todos</option>
                    <?php foreach (['pendiente','confirmada','completada','cancelada'] as $s): ?>
                    <option value="<?= $s ?>" <?= $filterStatus === $s ? 'selected' : '' ?>>
                        <?= ucfirst($s) ?>
                    </option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="col-auto">
                <button type="submit" class="btn btn-sm btn-ak">
                    <i class="fas fa-filter me-1"></i>Filtrar
                </button>
                <a href="appointments.php" class="btn btn-sm btn-outline-secondary ms-1">Limpiar</a>
            </div>
        </form>
    </div>
</div>

<!-- Tabla -->
<div class="ak-card">
    <div class="ak-card-head">
        <h6><i class="fas fa-calendar-check me-2" style="color:var(--ak-teal)"></i>
            <?= count($rows) ?> cita<?= count($rows) !== 1 ? 's' : '' ?>
        </h6>
    </div>
    <?php if (empty($rows)): ?>
    <div class="ak-card-body text-center text-muted py-5">
        <i class="fas fa-search fa-2x mb-3 d-block" style="opacity:.25"></i>
        No se encontraron citas con esos filtros
    </div>
    <?php else: ?>
    <div class="table-responsive">
        <table class="ak-tbl">
            <thead><tr>
                <th>Fecha</th><th>Hora</th><th>Paciente</th><th>Teléfono</th>
                <th>Servicio</th><th>Dur.</th><th>Estado</th><th>Acción</th>
            </tr></thead>
            <tbody>
            <?php foreach ($rows as $a): ?>
            <tr>
                <td><?= date('d/m/Y', strtotime($a['date'])) ?></td>
                <td><strong><?= fmtHour((int)$a['hour']) ?></strong></td>
                <td>
                    <a href="patient_detail.php?phone=<?= urlencode($a['phone']) ?>"
                       class="text-decoration-none fw-semibold">
                        <?= h($a['name']) ?>
                    </a>
                </td>
                <td><?= h($a['phone']) ?></td>
                <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    title="<?= h($a['service'] ?? '') ?>">
                    <?= h($a['service'] ?: 'Evaluación') ?>
                </td>
                <td><?= $a['duration'] ?>h</td>
                <td><?= statusBadge($a['status'] ?? 'pendiente') ?></td>
                <td>
                    <form method="POST" class="d-flex gap-1 align-items-center">
                        <input type="hidden" name="update_status" value="1">
                        <input type="hidden" name="id" value="<?= (int)$a['id'] ?>">
                        <select name="status" class="form-select form-select-sm" style="width:130px;font-size:12px">
                            <?php foreach (['pendiente','confirmada','completada','cancelada'] as $s): ?>
                            <option value="<?= $s ?>" <?= ($a['status'] ?? 'pendiente') === $s ? 'selected' : '' ?>>
                                <?= ucfirst($s) ?>
                            </option>
                            <?php endforeach; ?>
                        </select>
                        <button type="submit" class="btn btn-sm btn-ak" title="Guardar">
                            <i class="fas fa-check"></i>
                        </button>
                    </form>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
