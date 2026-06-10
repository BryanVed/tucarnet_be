# TuCarnet — Backend

API REST del sistema de carnet estudiantil digital de la UFPS. Gestiona el registro/login de estudiantes vía Firebase Authentication, la validación biométrica, la generación y validación de códigos QR del carnet, y la administración de solicitudes de cambio de foto.

## Tecnologías

- **NestJS 11** (sobre **Fastify**)
- **Prisma 6** + **PostgreSQL**
- **Firebase Admin SDK** (verificación de tokens)
- **JWT** (`@nestjs/jwt`, passport-jwt) para sesiones de administradores y firma de QR
- **APIs externas:** Divisist (SAT-SIA) y Moodle. En desarrollo/demo se reemplazan por el [`ufps-mock-api`](../ufps-mock-api).

> Todas las rutas están bajo el prefijo global **`/api`** (ver `src/main.ts`).

## Requisitos previos

- Node.js 20+ y npm
- Docker (para la base de datos local)
- Una credencial de cuenta de servicio de Firebase (`firebase-admin-key.json`)

## Puesta en marcha (local)

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar PostgreSQL

```bash
docker compose up -d
```

Esto expone Postgres en `localhost:5499` (usuario `admin`, contraseña `admin123`, base `mydb`), según `docker-compose.yml`.

### 3. Configurar variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```bash
cp .env.example .env
```

| Variable | Descripción |
|---|---|
| `NODE_ENV` | `development` (usa archivo de Firebase) o `production` (usa variable) |
| `PORT` | Puerto del servidor (default 3000) |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `JWT_SECRET` | Secreto para los JWT de administradores |
| `QR_JWT_SECRET` | Secreto para firmar/validar los QR |
| `DIVISIST_API_URL` | URL de la API Divisist (o del mock) |
| `DIVISIST_API_KEY` | Token de Divisist (el mock lo ignora) |
| `MOODLE_API_URL` | URL de la API Moodle (o del mock) |
| `MOODLE_API_TOKEN` | Token de Moodle (el mock lo ignora) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Solo en producción: JSON de la cuenta de servicio en una línea |

En desarrollo, apunta `DIVISIST_API_URL` y `MOODLE_API_URL` al mock (`http://localhost:8000`).

### 4. Credencial de Firebase

- **Desarrollo** (`NODE_ENV=development`): coloca el archivo `firebase-admin-key.json` en la **carpeta padre del proyecto** (`../firebase-admin-key.json`, ver `src/config/firebase.config.ts`). Está en `.gitignore`, nunca se versiona.
- **Producción** (`NODE_ENV=production`): no se usa archivo; se lee el JSON completo desde la variable `FIREBASE_SERVICE_ACCOUNT_KEY`.

> La app cliente debe usar el **mismo proyecto de Firebase**; de lo contrario la verificación de tokens fallará.

### 5. Generar el cliente Prisma y aplicar migraciones

```bash
npx prisma generate
npx prisma migrate dev
```

### 6. Arrancar el servidor

```bash
npm run start:dev    # modo watch (desarrollo)
npm run start        # desarrollo sin watch
npm run start:prod   # build + producción
```

La API queda en `http://localhost:3000/api`.

## Endpoints principales

Todos con prefijo `/api`.

### Autenticación (`/auth`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | Login/registro de estudiante. Requiere `Authorization: Bearer <Firebase ID token>`. Verifica en Divisist (y Moodle si es posgrado). |

### Estudiantes (`/student`)
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/student/:email` | Obtiene un estudiante por email |
| GET | `/student/code/:student_code` | Obtiene un estudiante por código |
| PATCH | `/student/biometric/validate` | Registra una validación biométrica |
| GET | `/student/biometric/status/:student_id` | Estado del perfil biométrico |
| PATCH | `/student/biometric/reset/:student_id` | Reinicia el perfil biométrico |
| PATCH | `/student/:id` | Actualiza datos del estudiante |

### QR (`/qr`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/qr/generate` | Genera el QR firmado del carnet |
| POST | `/qr/validate` | Valida un QR escaneado |

### Administradores (`/admin`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/login` | Login de administrador (JWT) |
| POST | `/admin` | Crea un administrador |
| GET | `/admin` | Lista administradores activos |
| GET | `/admin/inactive` | Lista administradores inactivos |
| GET | `/admin/all-status` | Lista todos los administradores |
| GET | `/admin/:id` | Obtiene un administrador |
| PATCH | `/admin/:id` | Actualiza un administrador |
| PATCH | `/admin/:id/password` | Cambia la contraseña |
| DELETE | `/admin/:id` | Elimina un administrador |

### Solicitudes de foto (`/photo-request`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/photo-request` | Crea una solicitud de cambio de foto |
| GET | `/photo-request/can-request/:student_id` | Indica si el estudiante puede solicitar |
| GET | `/photo-request/student/:student_id` | Solicitudes de un estudiante |
| GET | `/photo-request/pending` | Solicitudes pendientes |
| GET | `/photo-request/approved` | Solicitudes aprobadas |
| GET | `/photo-request/admin/:admin_id` | Solicitudes atendidas por un admin |
| GET | `/photo-request/statistics/overview` | Estadísticas generales |
| GET | `/photo-request/:request_id` | Detalle de una solicitud |
| PATCH | `/photo-request/respond` | Aprueba o rechaza una solicitud |

## Tests

```bash
npm run test        # unitarios
npm run test:e2e    # end-to-end
npm run test:cov    # cobertura
```

## Despliegue en Railway

1. **PostgreSQL:** añade un servicio **PostgreSQL** al proyecto de Railway.
2. **Servicio backend:** conéctalo a este repositorio.
3. **Comandos** (Settings):
   - Build: `npm install && npx prisma generate && npm run build`
   - Start: `npx prisma migrate deploy && node dist/main`
4. **Variables de entorno:**

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `JWT_SECRET` | secreto fuerte |
| `QR_JWT_SECRET` | secreto fuerte |
| `DIVISIST_API_URL` | URL pública del mock desplegado |
| `MOODLE_API_URL` | URL pública del mock desplegado |
| `DIVISIST_API_KEY` | cualquier valor (mock lo ignora) |
| `MOODLE_API_TOKEN` | cualquier valor (mock lo ignora) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON de la cuenta de servicio en una línea |

5. Genera el dominio enrutando al puerto **3000**.

> Para generar el JSON de Firebase compactado en una línea:
> ```powershell
> Get-Content firebase-admin-key.json -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
> ```

## Notas

- En desarrollo/demo se usa el `ufps-mock-api`, que **solo implementa el flujo de Divisist** (pregrado). El endpoint de Moodle (posgrado) no está mockeado: esos estudiantes quedarán como `NO_ACTIVO`.
- En `divisist.service.ts` el header `Authorization` está comentado porque el mock no requiere token; descoméntalo al usar la API real.
