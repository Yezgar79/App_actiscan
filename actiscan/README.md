# ActiScan 📦

> Sistema de gestión y auditoría de activos fijos mediante códigos QR  
> Universidad Politécnica de Querétaro · S-205

---

## Stack tecnológico

| Capa       | Tecnología         | Deploy         |
|------------|--------------------|----------------|
| Backend    | FastAPI + Python   | Render         |
| Base datos | PostgreSQL         | Render DB      |
| Frontend   | Next.js 14         | Vercel         |
| Móvil      | Expo Go (React Native) | Expo EAS   |

---

## Estructura del proyecto

```
actiscan/
├── backend/          # FastAPI + SQLAlchemy + PostgreSQL
│   ├── app/
│   │   ├── models.py       # Modelos de BD (Asset, User, Audit...)
│   │   ├── schemas.py      # Pydantic schemas (validación)
│   │   ├── auth.py         # JWT + bcrypt
│   │   ├── database.py     # Conexión PostgreSQL
│   │   ├── config.py       # Variables de entorno
│   │   ├── routers/
│   │   │   ├── auth.py     # Login, refresh, /me
│   │   │   ├── assets.py   # CRUD activos + QR
│   │   │   ├── audits.py   # Sesiones de auditoría
│   │   │   ├── dashboard.py# Stats generales
│   │   │   └── misc.py     # Users, Categories, Locations
│   │   └── utils/
│   │       └── qr.py       # Generador de códigos QR
│   ├── main.py             # Entry point FastAPI
│   └── requirements.txt
│
├── frontend/         # Next.js 14 App Router
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/        # Página de login
│   │   │   └── (app)/        # Layout autenticado
│   │   │       ├── dashboard/ # KPIs + gráficas
│   │   │       └── assets/    # CRUD activos + QR
│   │   ├── components/
│   │   │   ├── ui.tsx         # Componentes reutilizables
│   │   │   └── Sidebar.tsx    # Navegación lateral
│   │   ├── lib/api.ts         # Axios + interceptors JWT
│   │   ├── store/auth.ts      # Zustand auth store
│   │   └── types/index.ts     # TypeScript types
│   └── package.json
│
└── mobile/           # Expo Go (React Native)
    ├── app/
    │   ├── _layout.tsx       # Root layout
    │   ├── index.tsx         # Redirect inteligente
    │   ├── login.tsx         # Pantalla de login
    │   └── (tabs)/
    │       ├── home.tsx      # Dashboard móvil
    │       ├── scan.tsx      # Escáner QR (función principal)
    │       ├── inventory.tsx # Lista de activos
    │       ├── audits.tsx    # Auditorías activas
    │       └── profile.tsx   # Perfil + seguridad
    ├── src/
    │   ├── lib/api.ts        # Axios + SecureStore tokens
    │   ├── store/auth.ts     # Zustand store
    │   ├── theme.ts          # Design tokens
    │   └── types/index.ts    # Tipos compartidos
    └── app.json
```

---

## Configuración y arranque

### 1. Backend (FastAPI)

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tu DATABASE_URL y SECRET_KEY

# Arrancar servidor
uvicorn main:app --reload --port 8000
```

La API estará disponible en `http://localhost:8000`  
Documentación Swagger: `http://localhost:8000/docs`

### 2. Frontend (Next.js)

```bash
cd frontend
npm install

# Crear archivo de entorno
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Arrancar en desarrollo
npm run dev
```

El frontend estará en `http://localhost:3000`

### 3. Móvil (Expo Go)

```bash
cd mobile
npm install

# Crear archivo de entorno
echo "EXPO_PUBLIC_API_URL=http://TU_IP_LOCAL:8000" > .env

# Arrancar Expo
npx expo start
```

> ⚠️ En móvil usa la IP de tu computadora (no localhost).  
> Escanea el QR con la app **Expo Go** en tu teléfono.

---

## Deploy en producción

### Backend → Render

1. Crear nuevo **Web Service** en [render.com](https://render.com)
2. Conectar repositorio GitHub
3. Configurar:
   - **Root directory:** `backend`
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Agregar **PostgreSQL database** en Render
5. Copiar `DATABASE_URL` de la base de datos a las variables de entorno
6. Agregar `SECRET_KEY` (genera con `openssl rand -hex 32`)

### Frontend → Vercel

```bash
cd frontend
npx vercel --prod
```

Agregar variable de entorno en el dashboard de Vercel:
```
NEXT_PUBLIC_API_URL=https://actiscan-api.onrender.com
```

### Móvil → Expo EAS

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

---

## Seguridad implementada

| Requisito                  | Implementación                              |
|----------------------------|---------------------------------------------|
| Hasheado de contraseñas    | `bcrypt` via `passlib`                      |
| Protección API con JWT     | `python-jose`, tokens access + refresh      |
| Certificado SSL            | Automático en Render y Vercel               |
| Tokens seguros en móvil    | `expo-secure-store` (Keychain / Keystore)   |
| CORS configurado           | Solo orígenes autorizados                   |
| Roles y permisos           | admin / auditor / viewer en cada endpoint   |
| Validación de datos        | Pydantic en backend, Zod + react-hook-form  |

---

## KPIs del proyecto

| KPI                       | Fórmula                                          |
|---------------------------|--------------------------------------------------|
| Tasa crecimiento clientes | ((nuevos - anteriores) / anteriores) × 100       |
| Tasa de conversión canal  | (adquiridos / prospectos) × 100                  |
| Satisfacción cliente      | (satisfechos / encuestas) × 100                  |
| Disponibilidad sistema    | (tiempo operativo / tiempo total) × 100          |
| Cumplimiento SLA          | (incidencias resueltas / total) × 100            |

---

## Equipo

- Martínez García Gael Jesús  
- Uribe Hernández Diana María  
- González García Jesús  
- Orduña Orduña Yahir  

**Asesor:** Violeta Adriana Martínez Mandujano  
**Programa:** Ingeniería en Sistemas Computacionales — UPQ
