from flask import Blueprint, render_template, request, redirect, url_for, session, flash, g
from functools import wraps
from app.api_client import get_api, APIError

bp = Blueprint("capturista", __name__)


def capturista_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("access_token"):
            flash("Inicia sesión para continuar.", "warning")
            return redirect(url_for("auth.login", next=request.url))
        user = g.get("user")
        if not user:
            return redirect(url_for("auth.login"))
        if user.get("must_change_password"):
            return redirect(url_for("auth.change_password"))
        # Admins can also access capturista views
        if user.get("role") not in ("auditor", "viewer", "admin", "super_admin"):
            flash("Sin acceso a esta sección.", "danger")
            return redirect(url_for("auth.login"))
        return f(*args, **kwargs)
    return decorated


# ── Home / Dashboard ──────────────────────────────────────────────────────────

@bp.route("/")
@bp.route("/home")
@capturista_required
def home():
    api = get_api()
    stats = {}
    my_audits = []
    error = None
    try:
        stats = api.get("/api/audits/capturista-stats")
        my_audits = api.list_audits(status="en_curso", limit=5)
    except APIError as e:
        error = e.message
    return render_template("capturista/home.html",
                           stats=stats, my_audits=my_audits, error=error)


# ── My Audits ─────────────────────────────────────────────────────────────────

@bp.route("/audits")
@capturista_required
def audits():
    api = get_api()
    status = request.args.get("status", "")
    page = int(request.args.get("page", 1))
    limit = 15
    skip = (page - 1) * limit
    audit_list = []
    error = None
    try:
        audit_list = api.list_audits(status=status or None, skip=skip, limit=limit)
    except APIError as e:
        error = e.message
    return render_template("capturista/audits.html",
                           audits=audit_list, status=status,
                           page=page, limit=limit, error=error)


@bp.route("/audits/<session_id>")
@capturista_required
def audit_detail(session_id):
    api = get_api()
    audit = None
    assets = []
    error = None
    try:
        audit = api.get_audit(session_id)
        # Build quick-access list of audited assets
        assets = api.list_assets(limit=200)
    except APIError as e:
        error = e.message
    return render_template("capturista/audit_detail.html",
                           audit=audit, assets=assets, error=error)


@bp.route("/audits/<session_id>/scan", methods=["GET", "POST"])
@capturista_required
def scan(session_id):
    api = get_api()
    audit = None
    asset = None
    error = None
    success = None

    try:
        audit = api.get_audit(session_id)
    except APIError as e:
        flash(e.message, "danger")
        return redirect(url_for("capturista.audits"))

    if audit.get("status") != "en_curso":
        flash("Esta auditoría no está en curso.", "warning")
        return redirect(url_for("capturista.audit_detail", session_id=session_id))

    asset_id = request.args.get("asset_id") or request.form.get("asset_id")
    asset_code = request.args.get("code") or request.form.get("asset_code")

    if asset_code and not asset_id:
        try:
            asset = api.get_asset_by_code(asset_code)
            asset_id = asset["id"]
        except APIError:
            error = f"No se encontró un activo con el código '{asset_code}'."

    if asset_id and not asset:
        try:
            asset = api.get_asset(asset_id)
        except APIError as e:
            error = e.message

    if request.method == "POST" and asset and not error:
        action = request.form.get("action")
        if action == "lookup":
            pass  # Already loaded asset above
        else:
            result = request.form.get("result", "").strip()
            notes = request.form.get("notes", "").strip() or None
            severity = request.form.get("severity", "").strip() or None
            detected_location = request.form.get("detected_location", "").strip() or None
            detected_responsible = request.form.get("detected_responsible", "").strip() or None

            if not result:
                error = "Selecciona un resultado para el activo."
            else:
                try:
                    data = {
                        "asset_id": asset["id"],
                        "result": result,
                        "notes": notes,
                        "severity": severity,
                        "detected_location": detected_location,
                        "detected_responsible": detected_responsible,
                    }
                    api.scan_asset(session_id, data)
                    flash(f"Resultado registrado para {asset['name']}.", "success")
                    return redirect(url_for("capturista.scan", session_id=session_id))
                except APIError as e:
                    error = e.message

    all_assets = []
    try:
        all_assets = api.list_assets(limit=500)
    except APIError:
        pass

    return render_template(
        "capturista/scan.html",
        audit=audit, asset=asset, all_assets=all_assets,
        asset_id=asset_id or "", error=error,
    )


@bp.route("/audits/<session_id>/items/<item_id>/correct", methods=["GET", "POST"])
@capturista_required
def correct_item(session_id, item_id):
    api = get_api()
    audit = None
    item = None
    error = None

    try:
        audit = api.get_audit(session_id)
        # Find the item within the audit
        for i in audit.get("items", []):
            if i["id"] == item_id:
                item = i
                break
    except APIError as e:
        flash(e.message, "danger")
        return redirect(url_for("capturista.audits"))

    if not item:
        flash("Ítem no encontrado.", "danger")
        return redirect(url_for("capturista.audit_detail", session_id=session_id))

    if not item.get("returned_at"):
        flash("Este ítem no está devuelto para corrección.", "warning")
        return redirect(url_for("capturista.audit_detail", session_id=session_id))

    if request.method == "POST":
        data = {
            "result": request.form.get("result"),
            "notes": request.form.get("notes", "").strip() or None,
            "severity": request.form.get("severity", "").strip() or None,
            "detected_location": request.form.get("detected_location", "").strip() or None,
            "detected_responsible": request.form.get("detected_responsible", "").strip() or None,
        }
        try:
            api.update_audit_item(session_id, item_id, data)
            flash("Corrección enviada. El administrador revisará el ítem.", "success")
            return redirect(url_for("capturista.audit_detail", session_id=session_id))
        except APIError as e:
            error = e.message

    return render_template("capturista/correct_item.html",
                           audit=audit, item=item, error=error)


@bp.route("/audits/<session_id>/finish", methods=["POST"])
@capturista_required
def finish_audit(session_id):
    try:
        get_api().finish_audit(session_id)
        flash("Auditoría finalizada correctamente.", "success")
    except APIError as e:
        flash(e.message, "danger")
    return redirect(url_for("capturista.audits"))


# ── Returned Items ────────────────────────────────────────────────────────────

@bp.route("/returned")
@capturista_required
def returned():
    api = get_api()
    all_audits = []
    returned_items = []
    error = None
    try:
        all_audits = api.list_audits(limit=50)
        for audit in all_audits:
            for item in audit.get("items", []):
                if item.get("returned_at") and not item.get("approved_at"):
                    returned_items.append({
                        "audit": audit,
                        "item": item,
                    })
    except APIError as e:
        error = e.message
    return render_template("capturista/returned.html",
                           returned_items=returned_items, error=error)


# ── Profile ───────────────────────────────────────────────────────────────────

@bp.route("/profile", methods=["GET", "POST"])
@capturista_required
def profile():
    error = None
    if request.method == "POST":
        current = request.form.get("current_password", "")
        new_pwd = request.form.get("new_password", "")
        confirm = request.form.get("confirm_password", "")
        if not all([current, new_pwd, confirm]):
            error = "Completa todos los campos."
        elif new_pwd != confirm:
            error = "Las contraseñas no coinciden."
        else:
            try:
                get_api().change_password(current, new_pwd)
                flash("Contraseña actualizada correctamente.", "success")
            except APIError as e:
                error = e.message
    return render_template("capturista/profile.html", error=error)
