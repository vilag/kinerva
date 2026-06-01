<?php
$pageTitle = 'Pacientes';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/includes/helpers.php';
$db = getDB();

$search = trim($_GET['q'] ?? '');

$sql = 'SELECT
            p.id,
            p.name,
            p.phone,
            p.email,
            p.created_at,
            COUNT(a.id)  AS total_appts,
            MAX(a.date)  AS last_appt
        FROM patients p
        LEFT JOIN appointments a ON a.phone = p.phone
        WHERE 1=1 ' .
        ($search ? ' AND (p.name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)' : '') .
       ' GROUP BY p.id
         ORDER BY last_appt DESC, p.name
         LIMIT 200';

$params = $search
    ? ["%$search%", "%$search%", "%$search%"]
    : [];

$stmt = $db->prepare($sql);
$stmt->execute($params);
$patients = $stmt->fetchAll();
?>
<?php require_once __DIR__ . '/includes/header.php'; ?>

<!-- Búsqueda -->
<div class="ak-card mb-3">
    <div class="ak-card-body">
        <form method="GET" class="row g-2 align-items-end">
            <div class="col-sm-6 col-md-4">
                <label class="form-label" style="font-size:12px;font-weight:600">Buscar paciente</label>
                <input type="text" name="q" class="form-control form-control-sm"
                       placeholder="Nombre, teléfono o correo…" value="<?= h($search) ?>">
            </div>
            <div class="col-auto">
                <button type="submit" class="btn btn-sm btn-ak">
                    <i class="fas fa-search me-1"></i>Buscar
                </button>
                <?php if ($search): ?>
                <a href="patients.php" class="btn btn-sm btn-outline-secondary ms-1">Limpiar</a>
                <?php endif; ?>
            </div>
        </form>
    </div>
</div>

<!-- Lista -->
<div class="ak-card">
    <div class="ak-card-head">
        <h6><i class="fas fa-user-injured me-2" style="color:var(--ak-teal)"></i>
            <?= count($patients) ?> paciente<?= count($patients) !== 1 ? 's' : '' ?>
        </h6>
    </div>
    <?php if (empty($patients)): ?>
    <div class="ak-card-body text-center text-muted py-5">
        <i class="fas fa-users fa-2x mb-3 d-block" style="opacity:.25"></i>
        <?= $search ? 'Sin resultados para "' . h($search) . '"' : 'Aún no hay pacientes registrados' ?>
    </div>
    <?php else: ?>
    <div class="table-responsive">
        <table class="ak-tbl">
            <thead><tr>
                <th>Paciente</th><th>Teléfono</th><th>Correo</th>
                <th>Citas</th><th>Última cita</th><th></th>
            </tr></thead>
            <tbody>
            <?php foreach ($patients as $p): ?>
            <tr>
                <td>
                    <a href="patient_detail.php?id=<?= $p['id'] ?>"
                       class="text-decoration-none fw-semibold"><?= h($p['name']) ?></a>
                </td>
                <td><?= h($p['phone']) ?></td>
                <td><?= h($p['email'] ?? '—') ?></td>
                <td><span class="badge bg-secondary"><?= $p['total_appts'] ?></span></td>
                <td><?= $p['last_appt'] ? date('d/m/Y', strtotime($p['last_appt'])) : '—' ?></td>
                <td>
                    <a href="patient_detail.php?id=<?= $p['id'] ?>"
                       class="btn btn-sm btn-outline-secondary">
                        <i class="fas fa-folder-open"></i> Expediente
                    </a>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
    </div>
    <?php endif; ?>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
