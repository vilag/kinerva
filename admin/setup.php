<?php
session_start();
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/includes/helpers.php';

try {
    $db    = getDB();
    $count = cnt($db, 'SELECT COUNT(*) FROM admins');
} catch (PDOException $e) {
    die('Error de BD: ' . h($e->getMessage()) . ' — ¿Ejecutaste setup_admin.sql?');
}

// Solo accesible si no existe ningún admin
if ($count > 0) {
    header('Location: /admin/login.php');
    exit;
}

$error = $success = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password']  ?? '';
    $confirm  = $_POST['confirm']   ?? '';

    if (strlen($username) < 3)        $error = 'El usuario debe tener al menos 3 caracteres';
    elseif (strlen($password) < 6)    $error = 'La contraseña debe tener al menos 6 caracteres';
    elseif ($password !== $confirm)   $error = 'Las contraseñas no coinciden';
    else {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        $db->prepare('INSERT INTO admins (username, password_hash) VALUES (?,?)')->execute([$username, $hash]);
        $success = '¡Administrador creado! Ahora puedes iniciar sesión.';
    }
}
?><!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kinerva — Configuración Inicial</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
    <link href="/admin/assets/admin.css" rel="stylesheet">
</head>
<body>
<div class="ak-login-wrap">
    <div class="ak-login-box">
        <div class="ak-login-logo"><i class="fas fa-heartbeat"></i> Kinerva</div>
        <p class="text-muted" style="font-size:13px;margin-bottom:24px">Crear primer administrador</p>

        <?php if ($error): ?>
            <div class="alert alert-danger py-2 px-3" style="font-size:13px"><?= h($error) ?></div>
        <?php endif; ?>
        <?php if ($success): ?>
            <div class="alert alert-success py-2 px-3" style="font-size:13px"><?= h($success) ?>
                <a href="/admin/login.php" class="d-block mt-2 fw-bold">Ir al Login →</a>
            </div>
        <?php else: ?>
        <form method="POST">
            <div class="mb-3">
                <label class="form-label fw-semibold" style="font-size:13px">Usuario</label>
                <input type="text" name="username" class="form-control" required autofocus
                       value="<?= h($_POST['username'] ?? '') ?>">
            </div>
            <div class="mb-3">
                <label class="form-label fw-semibold" style="font-size:13px">Contraseña</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <div class="mb-4">
                <label class="form-label fw-semibold" style="font-size:13px">Confirmar contraseña</label>
                <input type="password" name="confirm" class="form-control" required>
            </div>
            <button type="submit" class="btn btn-ak w-100 fw-bold">
                <i class="fas fa-user-plus me-1"></i> Crear Administrador
            </button>
        </form>
        <?php endif; ?>
    </div>
</div>
</body>
</html>
