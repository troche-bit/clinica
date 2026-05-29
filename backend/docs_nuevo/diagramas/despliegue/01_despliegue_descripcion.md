# Descripción del Diagrama de Despliegue — Sistema Clínica Lichi

## Visión General

El sistema se despliega en una red de área local (LAN) compuesta por un servidor central
y cuatro equipos clientes. Todos los nodos se comunican a través de un router con firewall
mediante cable UTP Cat. 6 o conexión Wi-Fi.

---

## Nodos del Sistema

### Servidor / PC Administrador
Es el nodo principal de la infraestructura. Concentra toda la lógica de la aplicación
y los datos del sistema. Sus especificaciones son:

- **CPU:** Intel Core i7 3.6 GHz
- **Memoria:** 16 GB DDR4
- **Almacenamiento:** SSD 512 GB
- **Sistema Operativo:** Ubuntu 22.04 LTS

El servidor ejecuta **Docker Engine**, que contiene tres contenedores:

| Contenedor | Tecnología | Función |
|---|---|---|
| `clinica_frontend` | React (build estático) | Interfaz de usuario compilada para producción |
| `clinica_backend` | Django + Gunicorn | API REST — lógica de negocio y autenticación JWT |
| `clinica_db` | PostgreSQL 16 Alpine | Base de datos relacional |

**Nginx** actúa como punto de entrada único en el puerto 80 de la red local. Cumple dos
roles simultáneos: sirve los archivos estáticos del frontend (HTML, CSS, JS) y redirige
todas las peticiones al path `/api/` hacia Gunicorn en el puerto 8000 interno.
**Gunicorn** gestiona los workers del proceso Django, procesando las solicitudes de la API.
**PostgreSQL** permanece completamente aislado dentro de la red Docker, sin exposición
hacia la red local.

---

### Router / Firewall
Nodo de red central que conecta el servidor con los equipos clientes. Gestiona el
tráfico de la LAN (192.168.x.x) y provee seguridad perimetral básica mediante firewall.
Los clientes acceden al sistema escribiendo la IP del servidor en el navegador web.

---

### PC Recepción
Equipo destinado al personal de recepción, con las siguientes especificaciones:

- **CPU:** Intel Core i5 3.5 GHz
- **Memoria:** 8 GB DDR4
- **Almacenamiento:** Disco de 1 TB
- **Sistema Operativo:** Windows 10 Pro
- **Rol en el sistema:** Recepcionista

Desde este equipo se gestionan principalmente: agenda de turnos, registro de pacientes,
emisión de facturas y cobranzas.

---

### PC Consultorio 1, 2 y 3
Tres equipos ubicados en los consultorios médicos. Sus especificaciones son:

- **CPU:** Intel Core i3 3.5 GHz
- **Memoria:** 8 GB DDR4
- **Almacenamiento:** Disco de 1 TB
- **Sistema Operativo:** Windows 10 Pro
- **Rol en el sistema:** Médico / Secretaria Médica

Desde estos equipos los médicos acceden a la agenda del día, registran consultas y
gestionan documentos clínicos. Las secretarias médicas pueden gestionar la agenda
de su médico asignado.

---

## Flujo de Comunicación

```
Navegador (cliente)
       │  HTTP — puerto 80 (LAN)
       ▼
    Nginx
       ├── /          → archivos estáticos React
       └── /api/      → Gunicorn (puerto 8000 interno)
                              │
                              ▼
                          Django REST
                              │  TCP — puerto 5432 interno
                              ▼
                          PostgreSQL
```

1. El usuario abre el navegador y accede a la IP del servidor en el puerto 80.
2. Nginx responde con el frontend React (HTML/CSS/JS).
3. El frontend realiza peticiones a `/api/` que Nginx redirige a Gunicorn.
4. Django procesa la solicitud, consulta PostgreSQL y retorna la respuesta en JSON.
5. Los archivos multimedia (documentos digitalizados) se sirven desde el volumen
   Docker `/app/media`, que persiste entre reinicios del contenedor.

---

## Consideraciones de Producción

- **Nginx** reemplaza al servidor de desarrollo Vite, eliminando el puerto 5173 y
  centralizando todo el tráfico en el puerto 80.
- **Gunicorn** reemplaza al servidor de desarrollo de Django (`runserver`), aportando
  manejo de múltiples workers y mayor estabilidad ante carga concurrente.
- **PostgreSQL** no expone ningún puerto hacia la red local — solo es accesible
  internamente desde el contenedor del backend.
- El volumen Docker `./media:/app/media` garantiza que los documentos digitalizados
  persistan ante reinicios o actualizaciones del sistema.
- La arquitectura está preparada para escalar: Nginx puede configurarse con HTTPS
  (SSL/TLS) y Gunicorn puede aumentar el número de workers según la demanda.
