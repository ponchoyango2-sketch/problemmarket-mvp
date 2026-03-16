# ProblemMarket MVP

Marketplace global de problemas y soluciones con recompensas.

Estado actual:
- Backend Node.js + Express + JWT
- Frontend Next.js + TailwindCSS
- PostgreSQL con persistencia real
- Flujo completo: publicar problema -> enviar soluciones -> seleccionar ganador -> comisión plataforma

## Estructura

- `backend/` API Express y migraciones SQL
- `frontend/` App Next.js (App Router)
- `render.yaml` Blueprint para desplegar backend + PostgreSQL en Render

## Variables de entorno

Backend (`.env`):

```env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/problemmarket
PORT=4000
JWT_SECRET=change-me-in-production
CORS_ORIGIN=http://localhost:3000
DATABASE_SSL=false
DB_POOL_MAX=10
DB_IDLE_TIMEOUT_MS=30000
```

Frontend (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## Desarrollo local

1) Instalar dependencias backend:

```bash
npm install
```

2) Ejecutar migraciones:

```bash
npm run migrate
```

3) Levantar backend:

```bash
npm start
```

4) En otra terminal, levantar frontend:

```bash
cd frontend
npm install
npm run dev
```

## Endpoints backend

- `GET /` estado API
- `GET /health` healthcheck deploy
- `POST /users/register`
- `POST /users/login`
- `GET /problems`
- `POST /problems` (JWT)
- `GET /problems/:id`
- `POST /problems/:id/solutions` (JWT)
- `POST /problems/:id/select-winner` (JWT)
- `GET /platform/fees`

## Inicializar Git y primer commit

Desde la raíz del proyecto:

```bash
git init -b main
git add .
git commit -m "feat: initial ProblemMarket MVP with backend, frontend, auth, and postgres"
```

Si `git init -b main` no funciona en tu versión de Git:

```bash
git init
git branch -M main
```

## Subir a GitHub

1) Crea un repositorio vacío en GitHub (sin README).
2) Conecta remoto y sube:

```bash
git remote add origin https://github.com/TU_USUARIO/problemmarket-mvp.git
git push -u origin main
```

## Despliegue Frontend en Vercel

1) Importa el repo en Vercel.
2) Selecciona `frontend` como Root Directory.
3) Configura variable:

```env
NEXT_PUBLIC_API_URL=https://TU_BACKEND_URL_PUBLICA
```

4) Deploy.

## Despliegue Backend en Render

Opción rápida con Blueprint:
- En Render, usa "New > Blueprint" y selecciona este repo.
- Render leerá `render.yaml` y creará:
	- servicio web Node (`problemmarket-backend`)
	- base PostgreSQL (`problemmarket-db`)

Después del deploy:

1) Ejecuta migraciones en Shell del servicio web:

```bash
npm run migrate
```

2) Configura `CORS_ORIGIN` con la URL de Vercel.

## Despliegue Backend en Railway (alternativa)

1) Crea proyecto en Railway desde este repo.
2) Añade plugin PostgreSQL.
3) Variables requeridas:

```env
NODE_ENV=production
DATABASE_URL=<la inyectada por Railway>
DATABASE_SSL=true
JWT_SECRET=<secreto largo>
CORS_ORIGIN=https://TU_FRONTEND_VERCEL
PORT=4000
```

4) Ejecuta migraciones una vez desde Railway CLI o shell:

```bash
npm run migrate
```

## Checklist de producción

- [ ] `JWT_SECRET` fuerte y privado
- [ ] `CORS_ORIGIN` restringido a frontend público
- [ ] `DATABASE_SSL=true` en nube
- [ ] Migraciones ejecutadas en DB de producción
- [ ] Frontend apuntando al backend público
- [ ] Healthcheck `/health` en estado OK
