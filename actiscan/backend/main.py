from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from prometheus_fastapi_instrumentator import Instrumentator
from sqlalchemy import text
from app.config import get_settings
from app.database import Base, engine, get_db
from app.routers.auth import router as auth_router
from app.routers.assets import router as assets_router
from app.routers.audits import router as audits_router
from app.routers.dashboard import router as dashboard_router
from app.routers.misc import users_router, categories_router, locations_router
from app.routers.super_admin import router as super_admin_router
from app.routers.audit_logs import router as audit_logs_router
from app.routers.reports import router as reports_router

settings = get_settings()

# Apply schema changes not handled by Alembic in dev (new tables only)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ActiScan API",
    description="API para gestión y auditoría de activos fijos con QR",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Prometheus Metrics (/metrics) ────────────────────────────────────────────
Instrumentator().instrument(app).expose(app)

# ─── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(assets_router)
app.include_router(audits_router)
app.include_router(dashboard_router)
app.include_router(users_router)
app.include_router(categories_router)
app.include_router(locations_router)
app.include_router(super_admin_router)
app.include_router(audit_logs_router)
app.include_router(reports_router)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok", "service": "actiscan-api", "version": "2.0.0"}


@app.get("/health/detailed")
def health_detailed():
    """Check database connectivity and service status."""
    db_status = "ok"
    db_error = None
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = "error"
        db_error = "No se pudo conectar a la base de datos"

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "service": "actiscan-api",
        "version": "2.0.0",
        "database": db_status,
        "database_error": db_error,
    }
