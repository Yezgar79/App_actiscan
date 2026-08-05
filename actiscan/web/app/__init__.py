from flask import Flask, session, redirect, url_for, g
from flask_wtf.csrf import CSRFProtect
from flask_session import Session
from .config import Config
from .api_client import APIClient

csrf = CSRFProtect()
server_session = Session()


def create_app(config_class=Config):
    app = Flask(__name__, template_folder="templates", static_folder="static")
    app.config.from_object(config_class)

    csrf.init_app(app)
    server_session.init_app(app)

    # ── Global request context: inject current user ────────────────────────
    @app.before_request
    def load_user():
        g.user = None
        token = session.get("access_token")
        if token:
            try:
                api = APIClient(app.config["API_BASE_URL"], app.config["API_TIMEOUT"])
                g.user = api.me()
            except Exception:
                pass

    # ── Template globals ───────────────────────────────────────────────────
    @app.context_processor
    def inject_globals():
        return {
            "current_user": g.get("user"),
            "app_name": "ActiScan",
        }

    # ── Blueprints ─────────────────────────────────────────────────────────
    from .blueprints.auth.routes import bp as auth_bp
    from .blueprints.admin.routes import bp as admin_bp
    from .blueprints.capturista.routes import bp as cap_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(cap_bp, url_prefix="/capturista")

    # ── Root redirect ──────────────────────────────────────────────────────
    @app.route("/")
    def index():
        if not session.get("access_token"):
            return redirect(url_for("auth.login"))
        user = g.get("user")
        if user and user.get("role") in ("admin", "super_admin"):
            return redirect(url_for("admin.dashboard"))
        return redirect(url_for("capturista.home"))

    return app
