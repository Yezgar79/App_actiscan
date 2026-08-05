from flask import Blueprint, render_template, request, redirect, url_for, session, flash, g
from app.api_client import get_api, APIError

bp = Blueprint("auth", __name__, url_prefix="/auth")


def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("access_token"):
            flash("Inicia sesión para continuar.", "warning")
            return redirect(url_for("auth.login", next=request.url))
        return f(*args, **kwargs)
    return decorated


def _redirect_after_login(user: dict):
    """Redirect based on role after successful login."""
    if user.get("must_change_password"):
        return redirect(url_for("auth.change_password"))
    role = user.get("role", "")
    if role in ("admin", "super_admin"):
        return redirect(request.args.get("next") or url_for("admin.dashboard"))
    return redirect(request.args.get("next") or url_for("capturista.home"))


@bp.route("/login", methods=["GET", "POST"])
def login():
    if session.get("access_token"):
        user = g.get("user")
        if user:
            return _redirect_after_login(user)

    error = None
    if request.method == "POST":
        identifier = request.form.get("identifier", "").strip()
        password = request.form.get("password", "")

        if not identifier or not password:
            error = "Ingresa tu usuario/correo y contraseña."
        else:
            try:
                api = get_api()
                data = api.login(identifier, password)
                # Load user info to route correctly
                user = api.me()
                session["user_role"] = user.get("role") if user else None
                session["user_name"] = user.get("name") if user else None
                if user and user.get("must_change_password"):
                    session["must_change_password"] = True
                    flash("Debes cambiar tu contraseña antes de continuar.", "warning")
                    return redirect(url_for("auth.change_password"))
                return _redirect_after_login(user or {})
            except APIError as e:
                if e.status_code == 403:
                    error = e.message
                else:
                    error = "Credenciales incorrectas. Verifica tu usuario y contraseña."
            except Exception:
                error = "No se pudo conectar al servidor. Intenta más tarde."

    return render_template("auth/login.html", error=error)


@bp.route("/logout")
def logout():
    try:
        api = get_api()
        api.logout()
    except Exception:
        session.clear()
    flash("Sesión cerrada correctamente.", "success")
    return redirect(url_for("auth.login"))


@bp.route("/change-password", methods=["GET", "POST"])
@login_required
def change_password():
    error = None
    success = None
    if request.method == "POST":
        current = request.form.get("current_password", "")
        new_pwd = request.form.get("new_password", "")
        confirm = request.form.get("confirm_password", "")

        if not all([current, new_pwd, confirm]):
            error = "Completa todos los campos."
        elif new_pwd != confirm:
            error = "La nueva contraseña y su confirmación no coinciden."
        elif len(new_pwd) < 8:
            error = "La nueva contraseña debe tener al menos 8 caracteres."
        else:
            try:
                api = get_api()
                api.change_password(current, new_pwd)
                session.pop("must_change_password", None)
                success = "Contraseña actualizada correctamente."
                flash(success, "success")
                user = g.get("user")
                return _redirect_after_login(user or {})
            except APIError as e:
                error = e.message
            except Exception:
                error = "Error al cambiar la contraseña. Intenta de nuevo."

    return render_template("auth/change_password.html", error=error, success=success)
