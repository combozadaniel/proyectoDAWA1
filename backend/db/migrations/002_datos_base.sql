-- =====================================================================
-- ServiGest Ecuador - Migración 002: catálogos base del sistema
-- (datos necesarios para operar; los datos de prueba están en db/seeds)
-- =====================================================================

INSERT INTO roles (codigo, nombre) VALUES
    ('ADMIN',       'Administrador'),
    ('COORDINADOR', 'Coordinador'),
    ('TECNICO',     'Técnico'),
    ('CLIENTE',     'Cliente');

INSERT INTO estados (codigo, nombre, es_final, orden) VALUES
    ('REGISTRADA',     'Registrada',               FALSE, 1),
    ('APROBADA',       'Aprobada',                 FALSE, 2),
    ('ASIGNADA',       'Asignada',                 FALSE, 3),
    ('EN_PROCESO',     'En proceso',               FALSE, 4),
    ('PENDIENTE_INFO', 'Pendiente de información', FALSE, 5),
    ('RESUELTA',       'Resuelta',                 FALSE, 6),
    ('CERRADA',        'Cerrada',                  TRUE,  7),
    ('CANCELADA',      'Cancelada',                TRUE,  8);

-- Plazo de atención (SLA) contado desde el registro de la solicitud
INSERT INTO prioridades (codigo, nombre, horas_plazo, orden) VALUES
    ('BAJA',    'Baja',    120, 1),
    ('MEDIA',   'Media',    72, 2),
    ('ALTA',    'Alta',     24, 3),
    ('CRITICA', 'Crítica',   8, 4);

INSERT INTO parametros (clave, valor, descripcion) VALUES
    ('UMBRAL_POR_VENCER_PCT', '75',
     'Porcentaje del plazo consumido a partir del cual una solicitud se marca como próxima a vencer'),
    ('MAX_CARGA_DEFAULT', '5',
     'Máximo de solicitudes activas por técnico cuando se registra un técnico nuevo'),
    ('MAX_ADJUNTO_MB', '5',
     'Tamaño máximo permitido por archivo adjunto (MB)'),
    ('HORAS_EXPIRACION_RESET', '1',
     'Horas de vigencia del token de restablecimiento de contraseña');
