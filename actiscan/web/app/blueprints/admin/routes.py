from flask import (
    Blueprint, render_template, request, redirect, url_for,
    session, flash, g, jsonify, Response
)
from functools import wraps
from app.api_client import get_api, APIError
import json

bp = Blueprint("admin", __name__)


# ── Decorators ────────────────────────────────────────────────────────────────

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("access_token"):
            flash("Inicia sesión para continuar.", "warning")
            return redirect(url_for("auth.login", next=request.url))
        user = g.get("user")
        if not user or user.get("role") not in ("admin", "super_admin"):
            flash("No tienes permiso para acceder a esta sección.", "danger")
            return redirect(url_for("auth.login"))
        if user.get("must_change_password"):
            return redirect(url_for("auth.change_password"))
        return f(*args, **kwargs)
    return decorated


def super_admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("access_token"):
            return redirect(url_for("auth.login"))
        user = g.get("user")
        if not user or user.get("role") != "super_admin":
            flash("Se requiere rol de super administrador.", "danger")
            return redirect(url_for("admin.dashboard"))
        return f(*args, **kwargs)
    return decorated


# ── Dashboard ─────────────────────────────────────────────────────────────────

@bp.route("/")
@bp.route("/dashboard")
@admin_required
def dashboard():
    api = get_api()
    stats = {}
    recent_audits = []
    recent_logs = []
    error = None
    try:
        stats = api.dashboard_stats()
        recent_audits = api.list_audits(limit=5)
        recent_logs = api.list_audit_logs(limit=8)
    except APIError as e:
        error = e.message
    return render_template(
        "admin/dashboard.html",
        stats=stats,
        recent_audits=recent_audits,
        recent_logs=recent_logs,
        error=error,
    )


# ── Users ─────────────────────────────────────────────────────────────────────

@bp.route("/users")
@admin_required
def users():
    api = get_api()
    search = request.args.get("search", "")
    role = request.args.get("role", "")
    is_active = request.args.get("is_active", "")
    page = int(request.args.get("page", 1))
    limit = 20
    skip = (page - 1) * limit

    users_list = []
    error = None
    try:
        active_filter = None
        if is_active == "true":
            active_filter = True
        elif is_active == "false":
            active_filter = False
        users_list = api.list_users(
            search=search or None,
            role=role or None,
            is_active=active_filter,
            skip=skip,
            limit=limit,
        )
    except APIError as e:
        error = e.message

    return render_template(
        "admin/users/list.html",
        users=users_list,
        search=search,
        role=role,
        is_active=is_active,
        page=page,
        limit=limit,
        error=error,
    )


@bp.route("/users/new", methods=["GET", "POST"])
@admin_required
def users_new():
    api = get_api()
    error = None
    locations = []
    try:
        locations = api.list_locations()
    except APIError:
        pass

    if request.method == "POST":
        current_user = g.get("user")
        allowed_roles = ["auditor", "viewer"]
        if current_user and current_user.get("role") == "super_admin":
            allowed_roles = ["auditor", "viewer", "admin", "super_admin"]

        data = {
            "name": request.form.get("name", "").strip(),
            "username": request.form.get("username", "").strip() or None,
            "email": request.form.get("email", "").strip(),
            "employee_number": request.form.get("employee_number", "").strip() or None,
            "password": request.form.get("password", ""),
            "role": request.form.get("role", "auditor"),
            "assigned_location": request.form.get("assigned_location", "").strip() or None,
            "must_change_password": "must_change_password" in request.form,
        }
        if not data["name"] or not data["email"] or not data["password"]:
            error = "Nombre, correo y contraseña son obligatorios."
        elif data["role"] not in allowed_roles:
            error = "Rol no permitido para tu nivel de acceso."
        else:
            try:
                api.create_user(data)
                flash(f"Usuario {data['name']} creado correctamente.", "success")
                return redirect(url_for("admin.users"))
            except APIError as e:
                error = e.message

    return render_template("admin/users/form.html",
                           user=None, error=error, locations=locations,
                           is_edit=False)


@bp.route("/users/<user_id>/edit", methods=["GET", "POST"])
@admin_required
def users_edit(user_id):
    api = get_api()
    error = None
    locations = []
    user = None
    try:
        user = api.get_user(user_id)
        locations = api.list_locations()
    except APIError as e:
        flash(e.message, "danger")
        return redirect(url_for("admin.users"))

    if request.method == "POST":
        current_user = g.get("user")
        allowed_roles = ["auditor", "viewer"]
        if current_user and current_user.get("role") == "super_admin":
            allowed_roles = ["auditor", "viewer", "admin", "super_admin"]

        data = {
            "name": request.form.get("name", "").strip(),
            "username": request.form.get("username", "").strip() or None,
            "employee_number": request.form.get("employee_number", "").strip() or None,
            "role": request.form.get("role", user.get("role")),
            "assigned_location": request.form.get("assigned_location", "").strip() or None,
            "must_change_password": "must_change_password" in request.form,
        }
        if not data["name"]:
            error = "El nombre es obligatorio."
        elif data["role"] not in (allowed_roles + [user.get("role")]):
            error = "Rol no permitido para tu nivel de acceso."
        else:
            try:
                api.update_user(user_id, data)
                flash("Usuario actualizado correctamente.", "success")
                return redirect(url_for("admin.users"))
            except APIError as e:
                error = e.message

    return render_template("admin/users/form.html",
                           user=user, error=error, locations=locations,
                           is_edit=True)


@bp.route("/users/<user_id>/toggle-active", methods=["POST"])
@admin_required
def users_toggle_active(user_id):
    try:
        result = get_api().toggle_user_active(user_id)
        status = "activado" if result.get("is_active") else "desactivado"
        flash(f"Usuario {status} correctamente.", "success")
    except APIError as e:
        flash(e.message, "danger")
    return redirect(url_for("admin.users"))


@bp.route("/users/<user_id>/reset-password", methods=["GET", "POST"])
@admin_required
def users_reset_password(user_id):
    api = get_api()
    error = None
    user = None
    try:
        user = api.get_user(user_id)
    except APIError as e:
        flash(e.message, "danger")
        return redirect(url_for("admin.users"))

    if request.method == "POST":
        action = request.form.get("action")
        if action == "generate":
            try:
                result = api.generate_temp_password(user_id)
                flash(
                    f"Contraseña temporal generada: <strong>{result['temp_password']}</strong> "
                    f"(el usuario deberá cambiarla al iniciar sesión). "
                    f"Guarda esta contraseña, no se mostrará de nuevo.",
                    "success"
                )
                return redirect(url_for("admin.users"))
            except APIError as e:
                error = e.message
        else:
            new_pwd = request.form.get("new_password", "")
            must_change = "must_change_password" in request.form
            if not new_pwd:
                error = "Ingresa la nueva contraseña."
            else:
                try:
                    api.reset_user_password(user_id, new_pwd, must_change)
                    flash("Contraseña restablecida correctamente.", "success")
                    return redirect(url_for("admin.users"))
                except APIError as e:
                    error = e.message

    return render_template("admin/users/reset_password.html",
                           user=user, error=error)


# ── Locations ─────────────────────────────────────────────────────────────────

@bp.route("/locations")
@admin_required
def locations():
    api = get_api()
    include_inactive = request.args.get("include_inactive") == "true"
    locs = []
    error = None
    try:
        locs = api.list_locations(include_inactive=include_inactive)
    except APIError as e:
        error = e.message
    return render_template("admin/locations/list.html",
                           locations=locs, include_inactive=include_inactive, error=error)


@bp.route("/locations/new", methods=["GET", "POST"])
@admin_required
def locations_new():
    error = None
    if request.method == "POST":
        data = {
            "name": request.form.get("name", "").strip(),
            "floor": request.form.get("floor", "").strip() or None,
            "building": request.form.get("building", "").strip() or None,
            "description": request.form.get("description", "").strip() or None,
        }
        if not data["name"]:
            error = "El nombre de la ubicación es obligatorio."
        else:
            try:
                get_api().create_location(data)
                flash("Ubicación creada correctamente.", "success")
                return redirect(url_for("admin.locations"))
            except APIError as e:
                error = e.message
    return render_template("admin/locations/form.html",
                           location=None, error=error, is_edit=False)


@bp.route("/locations/<loc_id>/edit", methods=["GET", "POST"])
@admin_required
def locations_edit(loc_id):
    api = get_api()
    error = None
    location = None
    try:
        location = api.get_location(loc_id)
    except APIError as e:
        flash(e.message, "danger")
        return redirect(url_for("admin.locations"))

    if request.method == "POST":
        data = {
            "name": request.form.get("name", "").strip(),
            "floor": request.form.get("floor", "").strip() or None,
            "building": request.form.get("building", "").strip() or None,
            "description": request.form.get("description", "").strip() or None,
        }
        if "is_active" in request.form:
            data["is_active"] = request.form.get("is_active") == "true"
        if not data["name"]:
            error = "El nombre de la ubicación es obligatorio."
        else:
            try:
                get_api().update_location(loc_id, data)
                flash("Ubicación actualizada correctamente.", "success")
                return redirect(url_for("admin.locations"))
            except APIError as e:
                error = e.message
    return render_template("admin/locations/form.html",
                           location=location, error=error, is_edit=True)


# ── Categories ────────────────────────────────────────────────────────────────

@bp.route("/categories")
@admin_required
def categories():
    api = get_api()
    include_inactive = request.args.get("include_inactive") == "true"
    cats = []
    error = None
    try:
        cats = api.list_categories(include_inactive=include_inactive)
    except APIError as e:
        error = e.message
    return render_template("admin/categories/list.html",
                           categories=cats, include_inactive=include_inactive, error=error)


@bp.route("/categories/new", methods=["GET", "POST"])
@admin_required
def categories_new():
    error = None
    if request.method == "POST":
        data = {
            "name": request.form.get("name", "").strip(),
            "description": request.form.get("description", "").strip() or None,
        }
        if not data["name"]:
            error = "El nombre de la categoría es obligatorio."
        else:
            try:
                get_api().create_category(data)
                flash("Categoría creada correctamente.", "success")
                return redirect(url_for("admin.categories"))
            except APIError as e:
                error = e.message
    return render_template("admin/categories/form.html",
                           category=None, error=error, is_edit=False)


@bp.route("/categories/<cat_id>/edit", methods=["GET", "POST"])
@admin_required
def categories_edit(cat_id):
    api = get_api()
    error = None
    category = None
    try:
        category = api.get_category(cat_id)
    except APIError as e:
        flash(e.message, "danger")
        return redirect(url_for("admin.categories"))

    if request.method == "POST":
        data = {
            "name": request.form.get("name", "").strip(),
            "description": request.form.get("description", "").strip() or None,
        }
        if "is_active" in request.form:
            data["is_active"] = request.form.get("is_active") == "true"
        if not data["name"]:
            error = "El nombre de la categoría es obligatorio."
        else:
            try:
                get_api().update_category(cat_id, data)
                flash("Categoría actualizada correctamente.", "success")
                return redirect(url_for("admin.categories"))
            except APIError as e:
                error = e.message
    return render_template("admin/categories/form.html",
                           category=category, error=error, is_edit=True)


# ── Assets ────────────────────────────────────────────────────────────────────

@bp.route("/assets")
@admin_required
def assets():
    api = get_api()
    search = request.args.get("search", "")
    status = request.args.get("status", "")
    category_id = request.args.get("category_id", "")
    location_id = request.args.get("location_id", "")
    page = int(request.args.get("page", 1))
    limit = 25
    skip = (page - 1) * limit

    assets_list = []
    categories = []
    locations = []
    error = None
    try:
        assets_list = api.list_assets(
            search=search or None,
            status=status or None,
            category_id=category_id or None,
            location_id=location_id or None,
            skip=skip, limit=limit,
        )
        categories = api.list_categories()
        locations = api.list_locations()
    except APIError as e:
        error = e.message

    return render_template(
        "admin/assets/list.html",
        assets=assets_list, categories=categories, locations=locations,
        search=search, status=status, category_id=category_id,
        location_id=location_id, page=page, limit=limit, error=error,
    )


@bp.route("/assets/new", methods=["GET", "POST"])
@admin_required
def assets_new():
    api = get_api()
    error = None
    categories = []
    locations = []
    users = []
    try:
        categories = api.list_categories()
        locations = api.list_locations()
        users = api.list_users(limit=200)
    except APIError:
        pass

    if request.method == "POST":
        data = {
            "name": request.form.get("name", "").strip(),
            "description": request.form.get("description", "").strip() or None,
            "brand": request.form.get("brand", "").strip() or None,
            "model": request.form.get("model", "").strip() or None,
            "serial_number": request.form.get("serial_number", "").strip() or None,
            "inventory_number": request.form.get("inventory_number", "").strip() or None,
            "acquisition_value": float(request.form["acquisition_value"]) if request.form.get("acquisition_value") else None,
            "supplier": request.form.get("supplier", "").strip() or None,
            "invoice_number": request.form.get("invoice_number", "").strip() or None,
            "notes": request.form.get("notes", "").strip() or None,
            "status": request.form.get("status", "operativo"),
            "category_id": request.form.get("category_id") or None,
            "location_id": request.form.get("location_id") or None,
            "responsible_id": request.form.get("responsible_id") or None,
        }
        if request.form.get("acquisition_date"):
            data["acquisition_date"] = request.form["acquisition_date"] + "T00:00:00"
        if request.form.get("warranty_until"):
            data["warranty_until"] = request.form["warranty_until"] + "T00:00:00"

        if not data["name"]:
            error = "El nombre del activo es obligatorio."
        else:
            try:
                asset = api.create_asset(data)
                flash(f"Activo {asset['code']} creado correctamente.", "success")
                return redirect(url_for("admin.assets_detail", asset_id=asset["id"]))
            except APIError as e:
                error = e.message
            except (ValueError, TypeError) as e:
                error = f"Dato inválido: {e}"

    return render_template(
        "admin/assets/form.html",
        asset=None, categories=categories, locations=locations,
        users=users, error=error, is_edit=False,
    )


@bp.route("/assets/<asset_id>")
@admin_required
def assets_detail(asset_id):
    api = get_api()
    asset = None
    movements = []
    error = None
    try:
        asset = api.get_asset(asset_id)
        movements = api.get_asset_movements(asset_id)
    except APIError as e:
        error = e.message
    return render_template("admin/assets/detail.html",
                           asset=asset, movements=movements, error=error)


@bp.route("/assets/<asset_id>/edit", methods=["GET", "POST"])
@admin_required
def assets_edit(asset_id):
    api = get_api()
    error = None
    asset = None
    categories = []
    locations = []
    users = []
    try:
        asset = api.get_asset(asset_id)
        categories = api.list_categories()
        locations = api.list_locations()
        users = api.list_users(limit=200)
    except APIError as e:
        flash(e.message, "danger")
        return redirect(url_for("admin.assets"))

    if request.method == "POST":
        data = {
            "name": request.form.get("name", "").strip(),
            "description": request.form.get("description", "").strip() or None,
            "brand": request.form.get("brand", "").strip() or None,
            "model": request.form.get("model", "").strip() or None,
            "serial_number": request.form.get("serial_number", "").strip() or None,
            "inventory_number": request.form.get("inventory_number", "").strip() or None,
            "supplier": request.form.get("supplier", "").strip() or None,
            "invoice_number": request.form.get("invoice_number", "").strip() or None,
            "notes": request.form.get("notes", "").strip() or None,
            "status": request.form.get("status", asset.get("status", "operativo")),
            "category_id": request.form.get("category_id") or None,
            "location_id": request.form.get("location_id") or None,
            "responsible_id": request.form.get("responsible_id") or None,
        }
        if request.form.get("acquisition_value"):
            try:
                data["acquisition_value"] = float(request.form["acquisition_value"])
            except ValueError:
                error = "Valor de adquisición inválido."
        if request.form.get("acquisition_date"):
            data["acquisition_date"] = request.form["acquisition_date"] + "T00:00:00"
        if request.form.get("warranty_until"):
            data["warranty_until"] = request.form["warranty_until"] + "T00:00:00"

        if not error and not data["name"]:
            error = "El nombre del activo es obligatorio."
        if not error:
            try:
                api.update_asset(asset_id, data)
                flash("Activo actualizado correctamente.", "success")
                return redirect(url_for("admin.assets_detail", asset_id=asset_id))
            except APIError as e:
                error = e.message

    return render_template(
        "admin/assets/form.html",
        asset=asset, categories=categories, locations=locations,
        users=users, error=error, is_edit=True,
    )


# ── Audits ────────────────────────────────────────────────────────────────────

@bp.route("/audits")
@admin_required
def audits():
    api = get_api()
    status = request.args.get("status", "")
    auditor_id = request.args.get("auditor_id", "")
    location_id = request.args.get("location_id", "")
    page = int(request.args.get("page", 1))
    limit = 20
    skip = (page - 1) * limit

    audit_list = []
    users = []
    locations = []
    error = None
    try:
        audit_list = api.list_audits(
            status=status or None,
            auditor_id=auditor_id or None,
            location_id=location_id or None,
            skip=skip, limit=limit,
        )
        users = api.list_users(limit=200)
        locations = api.list_locations()
    except APIError as e:
        error = e.message

    return render_template(
        "admin/audits/list.html",
        audits=audit_list, users=users, locations=locations,
        status=status, auditor_id=auditor_id, location_id=location_id,
        page=page, limit=limit, error=error,
    )


@bp.route("/audits/new", methods=["GET", "POST"])
@admin_required
def audits_new():
    api = get_api()
    error = None
    users = []
    locations = []
    try:
        users = api.list_users(role="auditor", limit=200)
        users += api.list_users(role="admin", limit=50)
        locations = api.list_locations()
    except APIError:
        pass

    if request.method == "POST":
        data = {
            "title": request.form.get("title", "").strip(),
            "description": request.form.get("description", "").strip() or None,
            "auditor_id": request.form.get("auditor_id") or None,
            "location_id": request.form.get("location_id") or None,
            "notes": request.form.get("notes", "").strip() or None,
        }
        if request.form.get("planned_start"):
            data["planned_start"] = request.form["planned_start"] + ":00"
        if request.form.get("planned_end"):
            data["planned_end"] = request.form["planned_end"] + ":00"

        if not data["title"]:
            error = "El título de la auditoría es obligatorio."
        elif not data["auditor_id"]:
            error = "Debes asignar un capturista."
        else:
            try:
                audit = api.create_audit(data)
                flash(f"Auditoría {audit.get('audit_code', '')} creada correctamente.", "success")
                return redirect(url_for("admin.audits_detail", session_id=audit["id"]))
            except APIError as e:
                error = e.message

    return render_template("admin/audits/form.html",
                           users=users, locations=locations, error=error)


@bp.route("/audits/<session_id>")
@admin_required
def audits_detail(session_id):
    api = get_api()
    audit = None
    error = None
    try:
        audit = api.get_audit(session_id)
    except APIError as e:
        error = e.message
    return render_template("admin/audits/detail.html", audit=audit, error=error)


@bp.route("/audits/<session_id>/review")
@admin_required
def audits_review(session_id):
    api = get_api()
    audit = None
    error = None
    try:
        audit = api.get_audit(session_id)
    except APIError as e:
        error = e.message
    return render_template("admin/audits/review.html", audit=audit, error=error)


@bp.route("/audits/<session_id>/items/<item_id>/approve", methods=["POST"])
@admin_required
def audits_approve_item(session_id, item_id):
    try:
        get_api().approve_audit_item(session_id, item_id)
        flash("Activo aprobado correctamente.", "success")
    except APIError as e:
        flash(e.message, "danger")
    return redirect(url_for("admin.audits_review", session_id=session_id))


@bp.route("/audits/<session_id>/items/<item_id>/return", methods=["POST"])
@admin_required
def audits_return_item(session_id, item_id):
    comment = request.form.get("comment", "").strip()
    if not comment:
        flash("El comentario es obligatorio al devolver un ítem.", "danger")
        return redirect(url_for("admin.audits_review", session_id=session_id))
    try:
        get_api().return_audit_item(session_id, item_id, comment)
        flash("Ítem devuelto al capturista para corrección.", "warning")
    except APIError as e:
        flash(e.message, "danger")
    return redirect(url_for("admin.audits_review", session_id=session_id))


@bp.route("/audits/<session_id>/cancel", methods=["POST"])
@admin_required
def audits_cancel(session_id):
    reason = request.form.get("reason", "").strip()
    if not reason:
        flash("Debes indicar el motivo de cancelación.", "danger")
        return redirect(url_for("admin.audits_detail", session_id=session_id))
    try:
        get_api().cancel_audit(session_id, reason)
        flash("Auditoría cancelada.", "warning")
    except APIError as e:
        flash(e.message, "danger")
    return redirect(url_for("admin.audits"))


@bp.route("/audits/<session_id>/finish", methods=["POST"])
@admin_required
def audits_finish(session_id):
    try:
        get_api().finish_audit(session_id)
        flash("Auditoría finalizada y marcada como completada.", "success")
    except APIError as e:
        flash(e.message, "danger")
    return redirect(url_for("admin.audits_detail", session_id=session_id))


# ── Reports ───────────────────────────────────────────────────────────────────

@bp.route("/reports")
@admin_required
def reports():
    return render_template("admin/reports.html")


@bp.route("/reports/assets")
@admin_required
def reports_assets():
    api = get_api()
    filters = {k: v for k, v in request.args.items() if v}
    rows = []
    categories = []
    locations = []
    error = None
    try:
        rows = api.assets_report(**filters)
        categories = api.list_categories()
        locations = api.list_locations()
    except APIError as e:
        error = e.message
    return render_template("admin/reports_assets.html",
                           rows=rows, categories=categories,
                           locations=locations, filters=filters, error=error)


@bp.route("/reports/audits")
@admin_required
def reports_audits():
    api = get_api()
    filters = {k: v for k, v in request.args.items() if v}
    rows = []
    error = None
    try:
        rows = api.audits_report(**filters)
    except APIError as e:
        error = e.message
    return render_template("admin/reports_audits.html",
                           rows=rows, filters=filters, error=error)


@bp.route("/reports/assets/export")
@admin_required
def reports_assets_export():
    import requests as req
    from flask import current_app
    api_url = current_app.config["API_BASE_URL"]
    token = session.get("access_token", "")
    params = {k: v for k, v in request.args.items() if v}
    try:
        r = req.get(
            f"{api_url}/api/reports/assets/export",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        return Response(
            r.content,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=activos.csv"},
        )
    except Exception as e:
        flash(f"Error al exportar: {e}", "danger")
        return redirect(url_for("admin.reports_assets"))


@bp.route("/reports/audits/export")
@admin_required
def reports_audits_export():
    import requests as req
    from flask import current_app
    api_url = current_app.config["API_BASE_URL"]
    token = session.get("access_token", "")
    params = {k: v for k, v in request.args.items() if v}
    try:
        r = req.get(
            f"{api_url}/api/reports/audits/export",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
            timeout=30,
        )
        return Response(
            r.content,
            mimetype="text/csv",
            headers={"Content-Disposition": "attachment; filename=auditorias.csv"},
        )
    except Exception as e:
        flash(f"Error al exportar: {e}", "danger")
        return redirect(url_for("admin.reports_audits"))


# ── Audit Logs ────────────────────────────────────────────────────────────────

@bp.route("/audit-logs")
@admin_required
def audit_logs():
    api = get_api()
    module = request.args.get("module", "")
    action = request.args.get("action", "")
    user_id = request.args.get("user_id", "")
    date_from = request.args.get("date_from", "")
    date_to = request.args.get("date_to", "")
    page = int(request.args.get("page", 1))
    limit = 30
    skip = (page - 1) * limit

    logs = []
    users = []
    error = None
    try:
        logs = api.list_audit_logs(
            module=module or None,
            action=action or None,
            user_id=user_id or None,
            date_from=date_from or None,
            date_to=date_to or None,
            skip=skip, limit=limit,
        )
        users = api.list_users(limit=200)
    except APIError as e:
        error = e.message

    return render_template(
        "admin/audit_logs.html",
        logs=logs, users=users,
        module=module, action=action, user_id=user_id,
        date_from=date_from, date_to=date_to,
        page=page, limit=limit, error=error,
    )


# ── Monitoring ────────────────────────────────────────────────────────────────

@bp.route("/monitoring")
@admin_required
def monitoring():
    api = get_api()
    health = {}
    try:
        health = api.health()
    except Exception as e:
        health = {"status": "error", "error": str(e)}
    return render_template("admin/monitoring.html", health=health)


# ── Profile ───────────────────────────────────────────────────────────────────

@bp.route("/profile", methods=["GET", "POST"])
@admin_required
def profile():
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
        else:
            try:
                get_api().change_password(current, new_pwd)
                success = "Contraseña actualizada correctamente."
                flash(success, "success")
            except APIError as e:
                error = e.message
    return render_template("admin/profile.html", error=error, success=success)
