"""
Script de datos iniciales para ActiScan.
Ejecutar después de las migraciones: python seed.py

Crea: 1 super_admin, 1 admin, 2 auditores, 1 viewer
      6 categorías, 4 ubicaciones, 10 activos de ejemplo.
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.database import SessionLocal
from app import models
from app.auth import hash_password


USERS = [
    {
        "name": "Ing. Rafael Morales Peña",
        "username": "rmorales",
        "email": "r.morales@actiscan.mx",
        "employee_number": "SA-001",
        "password": "ActiScan#2025!",
        "role": models.UserRole.super_admin,
        "must_change_password": False,
    },
    {
        "name": "Lic. Diana Fuentes Vega",
        "username": "dfuentes",
        "email": "d.fuentes@actiscan.mx",
        "employee_number": "AD-001",
        "password": "Admin#2025!",
        "role": models.UserRole.admin,
        "must_change_password": False,
    },
    {
        "name": "Lic. Carlos Herrera Soto",
        "username": "cherrera",
        "email": "c.herrera@actiscan.mx",
        "employee_number": "CAP-001",
        "password": "Capturista#2025!",
        "role": models.UserRole.auditor,
        "must_change_password": False,
    },
    {
        "name": "Ing. Paola Ramírez Torres",
        "username": "pramirez",
        "email": "p.ramirez@actiscan.mx",
        "employee_number": "CAP-002",
        "password": "Capturista#2025!",
        "role": models.UserRole.auditor,
        "must_change_password": False,
    },
    {
        "name": "Lic. Roberto Mendoza Gil",
        "username": "rmendoza",
        "email": "r.mendoza@actiscan.mx",
        "employee_number": "VW-001",
        "password": "Viewer#2025!",
        "role": models.UserRole.viewer,
        "must_change_password": False,
    },
]

CATEGORIES = [
    {"name": "Equipos de Cómputo", "description": "Computadoras, laptops, servidores y periféricos"},
    {"name": "Mobiliario", "description": "Escritorios, sillas, archiveros y estantes"},
    {"name": "Equipo Audiovisual", "description": "Proyectores, pantallas, cámaras y sistemas de sonido"},
    {"name": "Redes y Telecomunicaciones", "description": "Switches, routers, access points y cableado"},
    {"name": "Electrodomésticos", "description": "Refrigeradores, microondas, cafeteras y similares"},
    {"name": "Vehículos", "description": "Automóviles, camionetas y vehículos institucionales"},
]

LOCATIONS = [
    {"name": "Oficina Central", "floor": "Piso 1", "building": "Torre A",
     "description": "Área de administración general"},
    {"name": "Almacén General", "floor": "Planta Baja", "building": "Bodega Norte",
     "description": "Almacén principal de activos"},
    {"name": "Sala de Reuniones A", "floor": "Piso 3", "building": "Torre A",
     "description": "Sala de reuniones ejecutiva"},
    {"name": "Cuarto de Servidores", "floor": "Piso 2", "building": "Torre B",
     "description": "Infraestructura de TI"},
]


def seed():
    db = SessionLocal()
    try:
        # ── Usuarios ──────────────────────────────────────────────────────────
        created_users = {}
        for u in USERS:
            existing = db.query(models.User).filter(models.User.email == u["email"]).first()
            if existing:
                print(f"  ✓ Ya existe: {u['email']}")
                created_users[u["username"]] = existing
                continue
            user = models.User(
                name=u["name"],
                username=u["username"],
                email=u["email"],
                employee_number=u["employee_number"],
                hashed_password=hash_password(u["password"]),
                role=u["role"],
                must_change_password=u["must_change_password"],
                is_active=True,
            )
            db.add(user)
            db.flush()
            created_users[u["username"]] = user
            print(f"  ✅ Creado: {u['email']} [{u['role']}]")

        # ── Categorías ────────────────────────────────────────────────────────
        created_cats = {}
        for c in CATEGORIES:
            existing = db.query(models.Category).filter(models.Category.name == c["name"]).first()
            if not existing:
                cat = models.Category(**c)
                db.add(cat)
                db.flush()
                created_cats[c["name"]] = cat
            else:
                created_cats[c["name"]] = existing

        # ── Ubicaciones ───────────────────────────────────────────────────────
        created_locs = {}
        for l in LOCATIONS:
            existing = db.query(models.Location).filter(models.Location.name == l["name"]).first()
            if not existing:
                loc = models.Location(**l)
                db.add(loc)
                db.flush()
                created_locs[l["name"]] = loc
            else:
                created_locs[l["name"]] = existing

        # ── Activos de ejemplo ────────────────────────────────────────────────
        if db.query(models.Asset).count() == 0:
            from app.utils.qr import generate_qr_base64, generate_asset_code
            sample_assets = [
                {
                    "name": "Laptop Dell Latitude 5530",
                    "brand": "Dell", "model": "Latitude 5530",
                    "serial_number": "DL5530-2024-001",
                    "inventory_number": "INV-2024-0001",
                    "category": "Equipos de Cómputo",
                    "location": "Oficina Central",
                    "status": models.AssetStatus.operativo,
                },
                {
                    "name": "Escritorio Ejecutivo",
                    "brand": "Steelcase", "model": "Series 1",
                    "inventory_number": "INV-2024-0002",
                    "category": "Mobiliario",
                    "location": "Oficina Central",
                    "status": models.AssetStatus.operativo,
                },
                {
                    "name": "Proyector Epson EH-TW750",
                    "brand": "Epson", "model": "EH-TW750",
                    "serial_number": "EP-TW750-2024-003",
                    "inventory_number": "INV-2024-0003",
                    "category": "Equipo Audiovisual",
                    "location": "Sala de Reuniones A",
                    "status": models.AssetStatus.operativo,
                },
                {
                    "name": "Switch Cisco Catalyst 2960",
                    "brand": "Cisco", "model": "Catalyst 2960",
                    "serial_number": "CS2960-2024-004",
                    "inventory_number": "INV-2024-0004",
                    "category": "Redes y Telecomunicaciones",
                    "location": "Cuarto de Servidores",
                    "status": models.AssetStatus.operativo,
                },
                {
                    "name": "Monitor LG 27UP850",
                    "brand": "LG", "model": "27UP850",
                    "serial_number": "LG27-2024-005",
                    "inventory_number": "INV-2024-0005",
                    "category": "Equipos de Cómputo",
                    "location": "Oficina Central",
                    "status": models.AssetStatus.operativo,
                },
            ]

            admin_user = created_users.get("dfuentes")
            for i, a in enumerate(sample_assets, 1):
                code = generate_asset_code(i)
                cat = created_cats.get(a.get("category"))
                loc = created_locs.get(a.get("location"))
                asset = models.Asset(
                    code=code,
                    name=a["name"],
                    brand=a.get("brand"),
                    model=a.get("model"),
                    serial_number=a.get("serial_number"),
                    inventory_number=a.get("inventory_number"),
                    status=a.get("status", models.AssetStatus.operativo),
                    category_id=cat.id if cat else None,
                    location_id=loc.id if loc else None,
                )
                db.add(asset)
                db.flush()
                asset.qr_code_url = generate_qr_base64(code, asset.id)
                if admin_user:
                    db.add(models.Movement(
                        asset_id=asset.id,
                        performed_by=admin_user.id,
                        movement_type=models.MovementType.registro,
                        description=f"Activo registrado en sistema (seed): {code}",
                    ))
            print("  ✅ 5 activos de ejemplo creados")

        db.commit()
        print("\n✅ Seed completado.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error en seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
