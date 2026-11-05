-- =====================================================================
-- ServiGest Ecuador - Migración 001: esquema inicial
-- Motor: PostgreSQL 14+
-- =====================================================================

-- ---------------------------------------------------------------------
-- Seguridad
-- ---------------------------------------------------------------------
CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    codigo      VARCHAR(20)  NOT NULL UNIQUE,
    nombre      VARCHAR(60)  NOT NULL
);

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(120) NOT NULL,
    password_hash   VARCHAR(100) NOT NULL,
    nombre          VARCHAR(120) NOT NULL,
    rol_id          SMALLINT     NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_usuarios_email CHECK (email = LOWER(email) AND email LIKE '%_@_%')
);
CREATE UNIQUE INDEX ux_usuarios_email ON usuarios (email);
CREATE INDEX ix_usuarios_rol ON usuarios (rol_id);

-- Tokens JWT revocados (cierre de sesión)
CREATE TABLE tokens_revocados (
    jti         UUID PRIMARY KEY,
    usuario_id  INT          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    expira_en   TIMESTAMPTZ  NOT NULL
);
CREATE INDEX ix_tokens_revocados_expira ON tokens_revocados (expira_en);

-- Restablecimiento controlado de contraseña (se guarda el hash del token, nunca el token)
CREATE TABLE restablecimientos_password (
    id          SERIAL PRIMARY KEY,
    usuario_id  INT          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  CHAR(64)     NOT NULL UNIQUE,
    expira_en   TIMESTAMPTZ  NOT NULL,
    usado_en    TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- Catálogos
-- ---------------------------------------------------------------------
CREATE TABLE especialidades (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(80)  NOT NULL,
    descripcion VARCHAR(255),
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ux_especialidades_nombre ON especialidades (LOWER(nombre));

CREATE TABLE categorias_servicio (
    id               SERIAL PRIMARY KEY,
    nombre           VARCHAR(80)  NOT NULL,
    descripcion      VARCHAR(255),
    especialidad_id  INT          NOT NULL REFERENCES especialidades(id) ON DELETE RESTRICT,
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ux_categorias_nombre ON categorias_servicio (LOWER(nombre));
CREATE INDEX ix_categorias_especialidad ON categorias_servicio (especialidad_id);

-- Prioridades con su plazo de atención (SLA) en horas
CREATE TABLE prioridades (
    id           SMALLSERIAL PRIMARY KEY,
    codigo       VARCHAR(20)  NOT NULL UNIQUE,
    nombre       VARCHAR(40)  NOT NULL,
    horas_plazo  INT          NOT NULL CHECK (horas_plazo > 0),
    orden        SMALLINT     NOT NULL UNIQUE
);

-- Parámetros operativos (clave/valor)
CREATE TABLE parametros (
    clave        VARCHAR(60)  PRIMARY KEY,
    valor        VARCHAR(255) NOT NULL,
    descripcion  VARCHAR(255),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Estados del ciclo de vida de la solicitud
CREATE TABLE estados (
    id        SMALLSERIAL PRIMARY KEY,
    codigo    VARCHAR(20) NOT NULL UNIQUE,
    nombre    VARCHAR(40) NOT NULL,
    es_final  BOOLEAN     NOT NULL DEFAULT FALSE,
    orden     SMALLINT    NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- Clientes y técnicos
-- ---------------------------------------------------------------------
CREATE TABLE clientes (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT          UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT,
    identificacion  VARCHAR(13)  NOT NULL,
    razon_social    VARCHAR(150) NOT NULL,
    email           VARCHAR(120) NOT NULL,
    telefono        VARCHAR(20),
    direccion       VARCHAR(255),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_clientes_identificacion CHECK (identificacion ~ '^[0-9]{10}([0-9]{3})?$')
);
CREATE UNIQUE INDEX ux_clientes_identificacion ON clientes (identificacion);

-- Sedes (sucursales) de cada cliente
CREATE TABLE sedes (
    id          SERIAL PRIMARY KEY,
    cliente_id  INT          NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    nombre      VARCHAR(100) NOT NULL,
    direccion   VARCHAR(255) NOT NULL,
    activo      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ux_sedes_cliente_nombre ON sedes (cliente_id, LOWER(nombre));

CREATE TABLE tecnicos (
    id                      SERIAL PRIMARY KEY,
    usuario_id              INT          NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT,
    cedula                  CHAR(10)     NOT NULL,
    telefono                VARCHAR(20),
    disponible              BOOLEAN      NOT NULL DEFAULT TRUE,
    max_solicitudes_activas SMALLINT     NOT NULL DEFAULT 5 CHECK (max_solicitudes_activas BETWEEN 1 AND 50),
    activo                  BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_tecnicos_cedula CHECK (cedula ~ '^[0-9]{10}$')
);
CREATE UNIQUE INDEX ux_tecnicos_cedula ON tecnicos (cedula);

CREATE TABLE tecnico_especialidades (
    tecnico_id      INT NOT NULL REFERENCES tecnicos(id) ON DELETE CASCADE,
    especialidad_id INT NOT NULL REFERENCES especialidades(id) ON DELETE RESTRICT,
    PRIMARY KEY (tecnico_id, especialidad_id)
);
CREATE INDEX ix_tecesp_especialidad ON tecnico_especialidades (especialidad_id);

-- ---------------------------------------------------------------------
-- Solicitudes
-- ---------------------------------------------------------------------
CREATE SEQUENCE solicitudes_codigo_seq;

CREATE TABLE solicitudes (
    id                      SERIAL PRIMARY KEY,
    codigo                  VARCHAR(20)  NOT NULL UNIQUE,
    cliente_id              INT          NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    sede_id                 INT          NOT NULL REFERENCES sedes(id) ON DELETE RESTRICT,
    categoria_id            INT          NOT NULL REFERENCES categorias_servicio(id) ON DELETE RESTRICT,
    prioridad_solicitada_id SMALLINT     NOT NULL REFERENCES prioridades(id) ON DELETE RESTRICT,
    prioridad_id            SMALLINT     NOT NULL REFERENCES prioridades(id) ON DELETE RESTRICT,
    estado_id               SMALLINT     NOT NULL REFERENCES estados(id) ON DELETE RESTRICT,
    tecnico_id              INT          REFERENCES tecnicos(id) ON DELETE RESTRICT,
    titulo                  VARCHAR(150) NOT NULL,
    descripcion             TEXT         NOT NULL,
    equipo_afectado         VARCHAR(150) NOT NULL,
    resolucion              TEXT,
    fecha_limite            TIMESTAMPTZ  NOT NULL,
    fecha_resolucion        TIMESTAMPTZ,
    fecha_cierre            TIMESTAMPTZ,
    creado_por              INT          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    version                 INT          NOT NULL DEFAULT 1,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_solicitudes_descripcion CHECK (LENGTH(descripcion) >= 10),
    CONSTRAINT ck_solicitudes_fechas CHECK (fecha_limite > created_at),
    CONSTRAINT ck_solicitudes_resolucion CHECK (fecha_resolucion IS NULL OR resolucion IS NOT NULL)
);
CREATE INDEX ix_solicitudes_estado ON solicitudes (estado_id);
CREATE INDEX ix_solicitudes_cliente ON solicitudes (cliente_id);
CREATE INDEX ix_solicitudes_tecnico ON solicitudes (tecnico_id);
CREATE INDEX ix_solicitudes_prioridad ON solicitudes (prioridad_id);
CREATE INDEX ix_solicitudes_categoria ON solicitudes (categoria_id);
CREATE INDEX ix_solicitudes_created ON solicitudes (created_at DESC);
CREATE INDEX ix_solicitudes_fecha_limite ON solicitudes (fecha_limite);

CREATE TABLE adjuntos (
    id               SERIAL PRIMARY KEY,
    solicitud_id     INT          NOT NULL REFERENCES solicitudes(id) ON DELETE CASCADE,
    nombre_original  VARCHAR(255) NOT NULL,
    nombre_archivo   VARCHAR(255) NOT NULL UNIQUE,
    mime_type        VARCHAR(100) NOT NULL,
    tamano_bytes     INT          NOT NULL CHECK (tamano_bytes > 0),
    subido_por       INT          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_adjuntos_solicitud ON adjuntos (solicitud_id);

-- Asignaciones de técnico (histórico; solo una activa por solicitud)
CREATE TABLE asignaciones (
    id               SERIAL PRIMARY KEY,
    solicitud_id     INT          NOT NULL REFERENCES solicitudes(id) ON DELETE RESTRICT,
    tecnico_id       INT          NOT NULL REFERENCES tecnicos(id) ON DELETE RESTRICT,
    asignado_por     INT          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    motivo           VARCHAR(500),
    activa           BOOLEAN      NOT NULL DEFAULT TRUE,
    fecha_asignacion TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    fecha_fin        TIMESTAMPTZ
);
CREATE UNIQUE INDEX ux_asignaciones_activa ON asignaciones (solicitud_id) WHERE activa;
CREATE INDEX ix_asignaciones_tecnico ON asignaciones (tecnico_id);

-- Historial inalterable de la solicitud (transiciones, asignaciones, comentarios)
CREATE TABLE historial_solicitudes (
    id                  BIGSERIAL PRIMARY KEY,
    solicitud_id        INT          NOT NULL REFERENCES solicitudes(id) ON DELETE RESTRICT,
    usuario_id          INT          NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    accion              VARCHAR(30)  NOT NULL CHECK (accion IN
                          ('CREACION','CAMBIO_ESTADO','ASIGNACION','REASIGNACION','COMENTARIO','REAPERTURA','ADJUNTO','CAMBIO_PRIORIDAD')),
    estado_anterior_id  SMALLINT     REFERENCES estados(id),
    estado_nuevo_id     SMALLINT     REFERENCES estados(id),
    comentario          TEXT,
    detalle             JSONB,
    fecha               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_historial_solicitud ON historial_solicitudes (solicitud_id, fecha);

-- Notificaciones por usuario
CREATE TABLE notificaciones (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    INT          NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo          VARCHAR(30)  NOT NULL,
    titulo        VARCHAR(150) NOT NULL,
    mensaje       VARCHAR(500) NOT NULL,
    solicitud_id  INT          REFERENCES solicitudes(id) ON DELETE CASCADE,
    leida         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_notificaciones_usuario ON notificaciones (usuario_id, leida, created_at DESC);

-- Auditoría general (catálogos, usuarios, seguridad)
CREATE TABLE auditoria (
    id            BIGSERIAL PRIMARY KEY,
    usuario_id    INT          REFERENCES usuarios(id) ON DELETE SET NULL,
    entidad       VARCHAR(50)  NOT NULL,
    entidad_id    VARCHAR(50),
    accion        VARCHAR(30)  NOT NULL,
    datos_antes   JSONB,
    datos_despues JSONB,
    ip            VARCHAR(64),
    fecha         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_auditoria_entidad ON auditoria (entidad, entidad_id);
CREATE INDEX ix_auditoria_fecha ON auditoria (fecha DESC);

-- ---------------------------------------------------------------------
-- Inalterabilidad: historial y auditoría no admiten UPDATE ni DELETE
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bloquear_modificacion() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'La tabla % es inalterable: no se permite %', TG_TABLE_NAME, TG_OP
        USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_historial_inalterable
    BEFORE UPDATE OR DELETE ON historial_solicitudes
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_modificacion();

CREATE TRIGGER tg_auditoria_inalterable
    BEFORE UPDATE OR DELETE ON auditoria
    FOR EACH ROW EXECUTE FUNCTION fn_bloquear_modificacion();
