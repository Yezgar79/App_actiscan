"""
Script para crear el usuario administrador inicial.
Ejecutar una sola vez después de las migraciones.

Uso:
    python seed.py
"""
import sys
import os
sys.path.append(os.path.dirname(__file__))

from app.database import SessionLocal
from app import models
from app.auth import hash_password


def seed():
    db = SessionLocal()
    try:
        # Check if admin already exists
        existing = db.query(models.User).filter(models.User.email == "admin@actiscan.mx").first()
        if existing:
            print("✓ El usuario admin ya existe.")
            return

        admin = models.User(
            name="Administrador ActiScan",
            email="admin@actiscan.mx",
            hashed_password=hash_password("ActiScan2024!"),
            role=models.UserRole.admin,
            is_active=True,
        )
        db.add(admin)

        # Seed categories
        categories = ["Equipos de Cómputo", "Mobiliario", "Audiovisual", "Redes", "Electrodomésticos", "Vehículos"]
        for name in categories:
            if not db.query(models.Category).filter(models.Category.name == name).first():
                db.add(models.Category(name=name))

        # Seed locations
        locations = [
            {"name": "Oficina Principal", "floor": "Piso 1", "building": "Torre A"},
            {"name": "Almacén Norte",     "floor": "Planta baja", "building": "Bodega"},
            {"name": "Sala de Juntas A",  "floor": "Piso 3", "building": "Torre A"},
            {"name": "Cuarto de Redes",   "floor": "Piso 2", "building": "Torre B"},
        ]
        for loc in locations:
            if not db.query(models.Location).filter(models.Location.name == loc["name"]).first():
                db.add(models.Location(**loc))

        db.commit()
        print("✅ Seed completado exitosamente.")
        print("   Email: admin@actiscan.mx")
        print("   Pass:  ActiScan2024!")
        print("   ⚠️  Cambia la contraseña en producción!")

    except Exception as e:
        db.rollback()
        print(f"❌ Error en seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
