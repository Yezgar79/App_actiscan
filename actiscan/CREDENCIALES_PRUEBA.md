# Credenciales de Prueba — ActiScan

> ⚠️ **CAMBIAR EN PRODUCCIÓN.** Este archivo no debe incluirse en el repositorio de producción.

## Usuarios del Sistema

| Rol          | Nombre                        | Usuario    | Email                    | Contraseña           | No. Empleado |
|--------------|-------------------------------|------------|--------------------------|----------------------|--------------|
| Super Admin  | Ing. Rafael Morales Peña      | rmorales   | r.morales@actiscan.mx    | `ActiScan#2025!`     | SA-001       |
| Admin        | Lic. Diana Fuentes Vega       | dfuentes   | d.fuentes@actiscan.mx    | `Admin#2025!`        | AD-001       |
| Capturista   | Lic. Carlos Herrera Soto      | cherrera   | c.herrera@actiscan.mx    | `Capturista#2025!`   | CAP-001      |
| Capturista   | Ing. Paola Ramírez Torres     | pramirez   | p.ramirez@actiscan.mx    | `Capturista#2025!`   | CAP-002      |
| Visor        | Lic. Roberto Mendoza Gil      | rmendoza   | r.mendoza@actiscan.mx    | `Viewer#2025!`       | VW-001       |

## Acceso a Interfaces

| Interfaz       | URL                        | Usuarios con acceso         |
|----------------|----------------------------|-----------------------------|
| Web Admin      | https://localhost/web      | Super Admin, Admin          |
| Web Capturista | https://localhost/web      | Capturista, Visor           |
| API Docs       | https://localhost/docs     | Todos (desarrollo)          |
| Grafana        | http://localhost:3001      | admin / actiscan123         |
| pgAdmin        | http://localhost:5050      | admin@actiscan.mx / actiscan123 |

## Notas de Seguridad

- El login acepta **correo electrónico** O **nombre de usuario** (campo `usuario`).
- Después de 5 intentos fallidos, la cuenta se bloquea 15 minutos.
- Los usuarios con `must_change_password=true` son redirigidos al cambio de contraseña al iniciar sesión.
- Los capturistas solo ven sus propias auditorías asignadas.
- Los administradores tienen acceso completo excepto gestión de super_admins.
