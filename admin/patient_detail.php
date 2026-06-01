<?php
$pageTitle = 'Expediente de Paciente';
require_once __DIR__ . '/includes/auth.php';
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/includes/helpers.php';
$db = getDB();

// Cargar paciente ────────────────────────────────────────────────────────────
$patient = null;
if (isset($_GET['id']) && (int)$_GET['id'] > 0) {
    $st = $db->prepare('SELECT * FROM patients WHERE id = ? LIMIT 1');
    $st->execute([(int)$_GET['id']]);
    $patient = $st->fetch();
} elseif (isset($_GET['phone'])) {
    $st = $db->prepare('SELECT * FROM patients WHERE phone = ? LIMIT 1');
    $st->execute([trim($_GET['phone'])]);
    $patient = $st->fetch();
    if (!$patient) {
        // Auto-crear desde citas existentes
        $st2 = $db->prepare('SELECT name,phone,email FROM appointments WHERE phone=? LIMIT 1');
        $st2->execute([trim($_GET['phone'])]);
        $appt = $st2->fetch();
        if ($appt) {
            $db->prepare('INSERT INTO patients (name,phone,email) VALUES(?,?,?)')->execute([
                $appt['name'], $appt['phone'], $appt['email'] ?: null
            ]);
            $patient = $db->prepare('SELECT * FROM patients WHERE phone=? LIMIT 1');
            $patient->execute([trim($_GET['phone'])]);
            $patient = $patient->fetch();
        }
    }
}
if (!$patient) { header('Location: patients.php'); exit; }

$pid      = (int)$patient['id'];
$backUrl  = 'patient_detail.php?id=' . $pid;

// Manejar formularios ────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';

    if ($action === 'update_patient') {
        $db->prepare(
            'UPDATE patients SET name=?,email=?,birth_date=?,notes=? WHERE id=?'
        )->execute([
            trim($_POST['name']  ?? $patient['name']),
            trim($_POST['email'] ?? '') ?: null,
            $_POST['birth_date'] ?: null,
            trim($_POST['notes'] ?? '') ?: null,
            $pid
        ]);
    } elseif ($action === 'add_note') {
        $content = trim($_POST['content'] ?? '');
        if ($content) {
            $db->prepare(
                'INSERT INTO patient_notes (patient_id,content,created_by) VALUES(?,?,?)'
            )->execute([$pid, $content, $_SESSION['admin_user']]);
        }
    } elseif ($action === 'delete_note') {
        $nid = (int)($_POST['note_id'] ?? 0);
        if ($nid) {
            $db->prepare('DELETE FROM patient_notes WHERE id=? AND patient_id=?')->execute([$nid, $pid]);
        }
    }
    header("Location: $backUrl");
    exit;
}

// Recargar datos actualizados
$st = $db->prepare('SELECT * FROM patients WHERE id=?');
$st->execute([$pid]);
$patient = $st->fetch();

// Citas del paciente
$appts = $db->prepare(
    'SELECT * FROM appointments WHERE phone=? ORDER BY date DESC, hour DESC'
);
$appts->execute([$patient['phone']]);
$appts = $appts->fetchAll();

// Notas clínicas
$notes = $db->prepare(
    'SELECT * FROM patient_notes WHERE patient_id=? ORDER BY created_at DESC'
);
$notes->execute([$pid]);
$notes = $notes->fetchAll();
?>
<?php require_once __DIR__ . '/includes/header.php'; ?>

<div class="mb-3">
    <a href="patients.php" class="text-decoration-none text-muted" style="font-size:13px">
        <i class="fas fa-arrow-left me-1"></i>Volver a Pacientes
    </a>
</div>

<div class="row g-3">

    <!-- Columna izquierda: info del paciente -->
    <div class="col-12 col-lg-4">

        <!-- Tarjeta de perfil -->
        <div class="ak-card mb-3">
            <div class="ak-card-head">
                <h6><i class="fas fa-user me-2" style="color:var(--ak-teal)"></i>Datos del Paciente</h6>
            </div>
            <div class="ak-card-body">
                <form method="POST">
                    <input type="hidden" name="action" value="update_patient">
                    <div class="mb-2">
                        <label class="form-label" style="font-size:12px;font-weight:600">Nombre completo</label>
                        <input type="text" name="name" class="form-control form-control-sm"
                               value="<?= h($patient['name']) ?>" required>
                    </div>
                    <div class="mb-2">
                        <label class="form-label" style="font-size:12px;font-weight:600">Teléfono</label>
                        <input type="text" class="form-control form-control-sm"
                               value="<?= h($patient['phone']) ?>" readonly style="background:#f8f9fa">
                    </div>
                    <div class="mb-2">
                        <label class="form-label" style="font-size:12px;font-weight:600">Correo</label>
                        <input type="email" name="email" class="form-control form-control-sm"
                               value="<?= h($patient['email'] ?? '') ?>" placeholder="—">
                    </div>
                    <div class="mb-3">
                        <label class="form-label" style="font-size:12px;font-weight:600">Fecha de nacimiento</label>
                        <input type="date" name="birth_date" class="form-control form-control-sm"
                               value="<?= h($patient['birth_date'] ?? '') ?>">
                    </div>
                    <button type="submit" class="btn btn-sm btn-ak w-100">
                        <i class="fas fa-save me-1"></i>Guardar cambios
                    </button>
                </form>
            </div>
        </div>

        <!-- Notas generales del paciente (campo libre) -->
        <div class="ak-card">
            <div class="ak-card-head">
                <h6><i class="fas fa-notes-medical me-2" style="color:var(--ak-teal)"></i>Antecedentes</h6>
            </div>
            <div class="ak-card-body">
                <form method="POST">
                    <input type="hidden" name="action" value="update_patient">
                    <input type="hidden" name="name"  value="<?= h($patient['name']) ?>">
                    <input type="hidden" name="email" value="<?= h($patient['email'] ?? '') ?>">
                    <input type="hidden" name="birth_date" value="<?= h($patient['birth_date'] ?? '') ?>">
                    <textarea name="notes" class="form-control form-control-sm"
                              rows="5" placeholder="Alergias, condiciones previas, medicamentos…"
                              style="font-size:13px"><?= h($patient['notes'] ?? '') ?></textarea>
                    <button type="submit" class="btn btn-sm btn-ak mt-2 w-100">
                        <i class="fas fa-save me-1"></i>Guardar
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- Columna derecha: historial + notas -->
    <div class="col-12 col-lg-8">

        <!-- Historial de citas -->
        <div class="ak-card mb-3">
            <div class="ak-card-head">
                <h6><i class="fas fa-history me-2" style="color:var(--ak-teal)"></i>
                    Historial de Citas (<?= count($appts) ?>)
                </h6>
            </div>
            <?php if (empty($appts)): ?>
            <div class="ak-card-body text-center text-muted py-4" style="font-size:13px">
                Sin citas registradas
            </div>
            <?php else: ?>
            <div class="table-responsive">
                <table class="ak-tbl">
                    <thead><tr><th>Fecha</th><th>Hora</th><th>Servicio</th><th>Dur.</th><th>Estado</th></tr></thead>
                    <tbody>
                    <?php foreach ($appts as $a): ?>
                    <tr>
                        <td><?= date('d/m/Y', strtotime($a['date'])) ?></td>
                        <td><?= fmtHour((int)$a['hour']) ?></td>
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

        <!-- Notas clínicas del expediente -->
        <div class="ak-card">
            <div class="ak-card-head">
                <h6><i class="fas fa-clipboard-list me-2" style="color:var(--ak-teal)"></i>
                    Notas Clínicas (<?= count($notes) ?>)
                </h6>
            </div>
            <div class="ak-card-body">
                <!-- Agregar nota -->
                <form method="POST" class="mb-4">
                    <input type="hidden" name="action" value="add_note">
                    <label class="form-label fw-semibold" style="font-size:13px">
                        <i class="fas fa-plus-circle me-1" style="color:var(--ak-teal)"></i>Nueva nota
                    </label>
                    <textarea name="content" class="form-control form-control-sm mb-2"
                              rows="3" required
                              placeholder="Evolución, diagnóstico, indicaciones…"
                              style="font-size:13px"></textarea>
                    <button type="submit" class="btn btn-sm btn-ak">
                        <i class="fas fa-plus me-1"></i>Agregar nota
                    </button>
                </form>

                <!-- Lista de notas -->
                <?php if (empty($notes)): ?>
                <p class="text-muted text-center py-3" style="font-size:13px">Sin notas registradas</p>
                <?php else: ?>
                <?php foreach ($notes as $n): ?>
                <div class="note-item">
                    <p class="mb-1" style="font-size:13px;white-space:pre-wrap"><?= h($n['content']) ?></p>
                    <div class="note-meta d-flex justify-content-between align-items-center">
                        <span>
                            <i class="fas fa-user me-1"></i><?= h($n['created_by'] ?? 'admin') ?>
                            &nbsp;·&nbsp;
                            <i class="fas fa-clock me-1"></i>
                            <?= date('d/m/Y H:i', strtotime($n['created_at'])) ?>
                        </span>
                        <form method="POST" onsubmit="return confirm('¿Eliminar esta nota?')">
                            <input type="hidden" name="action"  value="delete_note">
                            <input type="hidden" name="note_id" value="<?= (int)$n['id'] ?>">
                            <button type="submit" class="btn btn-sm btn-outline-danger py-0 px-2"
                                    style="font-size:11px">
                                <i class="fas fa-trash"></i>
                            </button>
                        </form>
                    </div>
                </div>
                <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </div>

    </div>
</div>

<?php require_once __DIR__ . '/includes/footer.php'; ?>
