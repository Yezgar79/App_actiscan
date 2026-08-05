import os
from datetime import timedelta


class Config:
    # Flask secret key — MUST be overridden in production via env var
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-actiscan-change-in-prod")

    # FastAPI backend URL (internal service name in Docker)
    API_BASE_URL = os.environ.get("API_BASE_URL", "http://backend:8000")

    # Session configuration (server-side filesystem sessions)
    SESSION_TYPE = "filesystem"
    SESSION_FILE_DIR = os.environ.get("SESSION_FILE_DIR", "/tmp/flask_sessions")
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    # Set Secure=True in production only
    SESSION_COOKIE_SECURE = os.environ.get("ENVIRONMENT", "development") == "production"
    PERMANENT_SESSION_LIFETIME = timedelta(hours=8)

    # WTF CSRF
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600

    # Request timeout to FastAPI (seconds)
    API_TIMEOUT = int(os.environ.get("API_TIMEOUT", "10"))

    # Environment
    ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
    DEBUG = ENVIRONMENT != "production"
