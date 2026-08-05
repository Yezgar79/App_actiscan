"""
Cliente HTTP centralizado para consumir la API FastAPI.
Toda comunicación con el backend pasa por esta clase.
Nunca se conecta directamente a PostgreSQL.
"""
import requests
from flask import session, redirect, url_for, current_app
from functools import wraps


class APIError(Exception):
    def __init__(self, message: str, status_code: int = 500, detail: str = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class APIClient:
    def __init__(self, base_url: str, timeout: int = 10):
        self._base = base_url.rstrip("/")
        self._timeout = timeout

    # ── Token management ────────────────────────────────────────────────────

    def _access_token(self) -> str | None:
        return session.get("access_token")

    def _refresh_token(self) -> str | None:
        return session.get("refresh_token")

    def _save_tokens(self, access: str, refresh: str, must_change: bool = False):
        session["access_token"] = access
        session["refresh_token"] = refresh
        if must_change:
            session["must_change_password"] = True

    def _clear_session(self):
        session.clear()

    def _try_refresh(self) -> bool:
        """Attempt to refresh the access token. Returns True on success."""
        refresh = self._refresh_token()
        if not refresh:
            return False
        try:
            resp = requests.post(
                f"{self._base}/api/auth/refresh",
                json={"refresh_token": refresh},
                timeout=self._timeout,
            )
            if resp.status_code == 200:
                data = resp.json()
                self._save_tokens(
                    data["access_token"],
                    data["refresh_token"],
                    data.get("must_change_password", False),
                )
                return True
        except requests.RequestException:
            pass
        return False

    # ── Core HTTP methods ────────────────────────────────────────────────────

    def _headers(self) -> dict:
        token = self._access_token()
        h = {"Content-Type": "application/json"}
        if token:
            h["Authorization"] = f"Bearer {token}"
        return h

    def _request(self, method: str, path: str, retry: bool = True, **kwargs):
        url = f"{self._base}{path}"
        kwargs.setdefault("timeout", self._timeout)
        kwargs.setdefault("headers", self._headers())

        try:
            resp = requests.request(method, url, **kwargs)
        except requests.Timeout:
            raise APIError("La API no respondió a tiempo. Intenta de nuevo.", 504)
        except requests.ConnectionError:
            raise APIError("No se pudo conectar al servidor. Verifica la conexión.", 503)

        if resp.status_code == 401 and retry:
            if self._try_refresh():
                kwargs["headers"] = self._headers()
                return self._request(method, path, retry=False, **kwargs)
            self._clear_session()
            raise APIError("Sesión expirada. Inicia sesión de nuevo.", 401)

        if resp.status_code == 403:
            try:
                detail = resp.json().get("detail", "Acceso denegado")
            except Exception:
                detail = "Acceso denegado"
            raise APIError(detail, 403)

        if resp.status_code == 404:
            try:
                detail = resp.json().get("detail", "Recurso no encontrado")
            except Exception:
                detail = "Recurso no encontrado"
            raise APIError(detail, 404)

        if resp.status_code == 422:
            try:
                errors = resp.json().get("detail", [])
                if isinstance(errors, list) and errors:
                    msgs = [e.get("msg", "") for e in errors]
                    detail = "; ".join(msgs)
                elif isinstance(errors, str):
                    detail = errors
                else:
                    detail = "Datos inválidos"
            except Exception:
                detail = "Datos inválidos"
            raise APIError(detail, 422)

        if resp.status_code >= 400:
            try:
                detail = resp.json().get("detail", f"Error {resp.status_code}")
            except Exception:
                detail = f"Error {resp.status_code}"
            raise APIError(detail, resp.status_code)

        if resp.status_code == 204:
            return None

        return resp.json()

    def get(self, path: str, params: dict = None):
        return self._request("GET", path, params=params)

    def post(self, path: str, data: dict = None):
        return self._request("POST", path, json=data)

    def put(self, path: str, data: dict = None):
        return self._request("PUT", path, json=data)

    def patch(self, path: str, data: dict = None):
        return self._request("PATCH", path, json=data)

    def delete(self, path: str):
        return self._request("DELETE", path)

    # ── Auth ────────────────────────────────────────────────────────────────

    def login(self, identifier: str, password: str) -> dict:
        resp = requests.post(
            f"{self._base}/api/auth/login",
            json={"email": identifier, "password": password},
            timeout=self._timeout,
        )
        if resp.status_code == 401:
            raise APIError("Credenciales incorrectas", 401)
        if resp.status_code == 403:
            detail = resp.json().get("detail", "Acceso denegado")
            raise APIError(detail, 403)
        if resp.status_code >= 400:
            detail = resp.json().get("detail", "Error al iniciar sesión")
            raise APIError(detail, resp.status_code)
        data = resp.json()
        self._save_tokens(
            data["access_token"],
            data["refresh_token"],
            data.get("must_change_password", False),
        )
        return data

    def logout(self):
        try:
            self.post("/api/auth/logout")
        except APIError:
            pass
        self._clear_session()

    def me(self) -> dict | None:
        try:
            return self.get("/api/auth/me")
        except APIError:
            return None

    def change_password(self, current: str, new: str):
        return self.post("/api/auth/change-password", {
            "current_password": current,
            "new_password": new,
        })

    # ── Dashboard ───────────────────────────────────────────────────────────

    def dashboard_stats(self) -> dict:
        return self.get("/api/dashboard")

    # ── Users ───────────────────────────────────────────────────────────────

    def list_users(self, search=None, role=None, is_active=None, skip=0, limit=50):
        params = {"skip": skip, "limit": limit}
        if search:
            params["search"] = search
        if role:
            params["role"] = role
        if is_active is not None:
            params["is_active"] = is_active
        return self.get("/api/users", params=params)

    def get_user(self, user_id: str):
        return self.get(f"/api/users/{user_id}")

    def create_user(self, data: dict):
        return self.post("/api/users", data)

    def update_user(self, user_id: str, data: dict):
        return self.put(f"/api/users/{user_id}", data)

    def toggle_user_active(self, user_id: str):
        return self.post(f"/api/users/{user_id}/toggle-active")

    def reset_user_password(self, user_id: str, new_password: str, must_change: bool = True):
        return self.post(f"/api/users/{user_id}/reset-password", {
            "new_password": new_password,
            "must_change_password": must_change,
        })

    def generate_temp_password(self, user_id: str):
        return self.post(f"/api/users/{user_id}/generate-password")

    # ── Categories ──────────────────────────────────────────────────────────

    def list_categories(self, include_inactive=False):
        return self.get("/api/categories", params={"include_inactive": include_inactive})

    def get_category(self, cat_id: str):
        return self.get(f"/api/categories/{cat_id}")

    def create_category(self, data: dict):
        return self.post("/api/categories", data)

    def update_category(self, cat_id: str, data: dict):
        return self.put(f"/api/categories/{cat_id}", data)

    # ── Locations ───────────────────────────────────────────────────────────

    def list_locations(self, include_inactive=False):
        return self.get("/api/locations", params={"include_inactive": include_inactive})

    def get_location(self, loc_id: str):
        return self.get(f"/api/locations/{loc_id}")

    def create_location(self, data: dict):
        return self.post("/api/locations", data)

    def update_location(self, loc_id: str, data: dict):
        return self.put(f"/api/locations/{loc_id}", data)

    # ── Assets ──────────────────────────────────────────────────────────────

    def list_assets(self, search=None, status=None, category_id=None,
                    location_id=None, skip=0, limit=50):
        params = {"skip": skip, "limit": limit}
        if search:
            params["search"] = search
        if status:
            params["status"] = status
        if category_id:
            params["category_id"] = category_id
        if location_id:
            params["location_id"] = location_id
        return self.get("/api/assets", params=params)

    def get_asset(self, asset_id: str):
        return self.get(f"/api/assets/{asset_id}")

    def get_asset_by_code(self, code: str):
        return self.get(f"/api/assets/by-code/{code}")

    def create_asset(self, data: dict):
        return self.post("/api/assets", data)

    def update_asset(self, asset_id: str, data: dict):
        return self.put(f"/api/assets/{asset_id}", data)

    def get_asset_movements(self, asset_id: str):
        return self.get(f"/api/assets/{asset_id}/movements")

    # ── Audits ──────────────────────────────────────────────────────────────

    def list_audits(self, status=None, auditor_id=None, location_id=None, skip=0, limit=20):
        params = {"skip": skip, "limit": limit}
        if status:
            params["status"] = status
        if auditor_id:
            params["auditor_id"] = auditor_id
        if location_id:
            params["location_id"] = location_id
        return self.get("/api/audits", params=params)

    def get_audit(self, session_id: str):
        return self.get(f"/api/audits/{session_id}")

    def create_audit(self, data: dict):
        return self.post("/api/audits", data)

    def update_audit(self, session_id: str, data: dict):
        return self.put(f"/api/audits/{session_id}", data)

    def cancel_audit(self, session_id: str, reason: str):
        return self.patch(f"/api/audits/{session_id}/cancel", {"reason": reason})

    def finish_audit(self, session_id: str):
        return self.patch(f"/api/audits/{session_id}/finish")

    def scan_asset(self, session_id: str, data: dict):
        return self.post(f"/api/audits/{session_id}/scan", data)

    def update_audit_item(self, session_id: str, item_id: str, data: dict):
        return self.put(f"/api/audits/{session_id}/items/{item_id}", data)

    def return_audit_item(self, session_id: str, item_id: str, comment: str):
        return self.post(f"/api/audits/{session_id}/items/{item_id}/return",
                         {"comment": comment})

    def approve_audit_item(self, session_id: str, item_id: str):
        return self.post(f"/api/audits/{session_id}/items/{item_id}/approve")

    # ── Audit Logs ──────────────────────────────────────────────────────────

    def list_audit_logs(self, user_id=None, module=None, action=None,
                        entity_type=None, date_from=None, date_to=None,
                        skip=0, limit=50):
        params = {"skip": skip, "limit": limit}
        if user_id:
            params["user_id"] = user_id
        if module:
            params["module"] = module
        if action:
            params["action"] = action
        if entity_type:
            params["entity_type"] = entity_type
        if date_from:
            params["date_from"] = date_from
        if date_to:
            params["date_to"] = date_to
        return self.get("/api/audit-logs", params=params)

    # ── Reports ─────────────────────────────────────────────────────────────

    def assets_report(self, **filters):
        return self.get("/api/reports/assets", params=filters)

    def audits_report(self, **filters):
        return self.get("/api/reports/audits", params=filters)

    # ── Health ──────────────────────────────────────────────────────────────

    def health(self) -> dict:
        try:
            resp = requests.get(
                f"{self._base}/health/detailed",
                timeout=self._timeout,
            )
            return resp.json()
        except Exception as e:
            return {"status": "error", "error": str(e)}

    def super_admin_stats(self) -> dict:
        return self.get("/api/super-admin/stats")


def get_api() -> APIClient:
    """Return the per-request API client (uses Flask app config)."""
    return APIClient(
        base_url=current_app.config["API_BASE_URL"],
        timeout=current_app.config["API_TIMEOUT"],
    )
