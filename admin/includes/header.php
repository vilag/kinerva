<?php
$cur = basename($_SERVER['PHP_SELF']);
$isPatients = in_array($cur, ['patients.php', 'patient_detail.php']);
?><!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Kinerva Admin — <?= h($pageTitle ?? 'Panel') ?></title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
    <link href="/admin/assets/admin.css" rel="stylesheet">
</head>
<body>

<aside class="ak-sidebar">
    <a class="ak-brand" href="/admin/index.php">
        <i class="fas fa-heartbeat"></i> Kinerva
    </a>
    <nav class="ak-nav">
        <a href="/admin/index.php"       class="<?= $cur === 'index.php'       ? 'active' : '' ?>">
            <i class="fas fa-chart-pie"></i> Dashboard
        </a>
        <span class="ak-nav-sep">Gestión</span>
        <a href="/admin/appointments.php" class="<?= $cur === 'appointments.php' ? 'active' : '' ?>">
            <i class="fas fa-calendar-check"></i> Citas
        </a>
        <a href="/admin/patients.php"     class="<?= $isPatients               ? 'active' : '' ?>">
            <i class="fas fa-user-injured"></i> Pacientes
        </a>
    </nav>
    <div class="ak-user-foot">
        <i class="fas fa-user-circle"></i>
        <span><?= h($_SESSION['admin_user'] ?? '') ?></span>
        <a href="/admin/logout.php" title="Cerrar sesión"><i class="fas fa-sign-out-alt"></i></a>
    </div>
</aside>

<div class="ak-main">
    <div class="ak-topbar">
        <span class="ak-topbar-title"><?= h($pageTitle ?? '') ?></span>
        <span class="ak-topbar-meta"><?= date('d/m/Y') ?></span>
    </div>
    <div class="ak-body">
