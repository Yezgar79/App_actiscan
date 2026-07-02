from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from app.config import get_settings
from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.assets import router as assets_router
from app.routers.audits import router as audits_router
from app.routers.dashboard import router as dashboard_router
from app.routers.misc import users_router, categories_router, locations_router

settings = get_settings()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="ActiScan API",
    description="API para gestión y auditoría de activos fijos con QR",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

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


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health")
def health():
    return {"status": "ok", "service": "actiscan-api"}
