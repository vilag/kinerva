<?php
session_start();
if (isset($_SESSION['admin_id'])) {
    header('Location: /admin/index.php');
    exit;
}
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/includes/helpers.php';

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username && $password) {
        try {
            $stmt = getDB()->prepare('SELECT id, password_hash FROM admins WHERE username = ? LIMIT 1');
            $stmt->execute([$username]);
            $admin = $stmt->fetch();

            if ($admin && password_verify($password, $admin['password_hash'])) {
                session_regenerate_id(true);
                $_SESSION['admin_id']   = $admin['id'];
                $_SESSION['admin_user'] = $username;
                header('Location: /admin/index.php');
                exit;
            }
            $error = 'Usuario o contraseña incorrectos';
        } catch (PDOException $e) {
            $error = 'Error de base de datos. Verifica la conexión.';
        }
    } else {
        $error = 'Completa todos los campos';
    }
}
?><!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kinerva — Acceso Admin</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
    <link href="/admin/assets/admin.css" rel="stylesheet">
</head>
<body>
<div class="ak-login-wrap">
    <div class="ak-login-box">
        <div class="ak-login-logo"><i class="fas fa-heartbeat"></i> Kinerva</div>
        <p class="text-muted" style="font-size:13px;margin-bottom:24px">Panel de Administración</p>

        <?php if ($error): ?>
            <div class="alert alert-danger py-2 px-3" style="font-size:13px">
                <i class="fas fa-exclamation-circle me-1"></i><?= h($error) ?>
            </div>
        <?php endif; ?>

        <form method="POST">
            <div class="mb-3">
                <label class="form-label fw-semibold" style="font-size:13px">Usuario</label>
                <input type="text" name="username" class="form-control" autofocus required
                       value="<?= h($_POST['username'] ?? '') ?>">
            </div>
            <div class="mb-4">
                <label class="form-label fw-semibold" style="font-size:13px">Contraseña</label>
                <input type="password" name="password" class="form-control" required>
            </div>
            <button type="submit" class="btn btn-ak w-100 fw-bold">
                <i class="fas fa-sign-in-alt me-1"></i> Ingresar
            </button>
        </form>

        <p class="text-center mt-3" style="font-size:12px;color:#ccc">
            ¿Primera vez? <a href="/admin/setup.php" style="color:var(--ak-teal)">Crear cuenta de admin</a>
        </p>
    </div>
</div>
</body>
</html>
