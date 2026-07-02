# Clínica Lichi — Sistema de Gestión Clínica

Sistema web completo desarrollado como proyecto de tesis de grado en Ingeniería Informática (Universidad Nihon Gakko, Paraguay).

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React · JavaScript |
| Backend | Django REST Framework (Python) |
| Base de datos | PostgreSQL |
| Autenticación | JWT |
| Infraestructura | Docker · Docker Compose · Nginx |

---

## Características principales

- Registro y gestión de pacientes con expedientes clínicos
- Sistema de turnos y agenda médica
- Historial clínico por paciente
- Reportes administrativos
- API REST con autenticación JWT
- Diseño responsivo (mobile-friendly)
- Arquitectura dockerizada lista para despliegue

---

## Arquitectura

El sistema fue diseñado y desarrollado desde cero:

- Modelado completo de base de datos relacional en PostgreSQL
- API REST con Django REST Framework y autenticación JWT
- Arquitectura de componentes en React con gestión de estado
- Reverse proxy con Nginx
- Contenerización con Docker Compose (desarrollo y producción)

---

## Instalación local

```bash
# Clonar el repositorio
git clone https://github.com/troche-bit/clinica.git
cd clinica

# Configurar variables de entorno
cp .env.example .env

# Levantar con Docker
docker-compose up --build

# O manualmente:
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend (otra terminal)
cd frontend
npm install
npm start
```

---

## Estado del proyecto

🟢 Sistema funcional en entorno local — desarrollado y defendido como tesis de grado.

> El deploy público está pendiente por restricciones académicas del proceso de evaluación.

---

## Documentación

La documentación completa del sistema (modelado de datos, casos de uso, arquitectura) está disponible en la carpeta `/docs`.

---

## Autor

**Enzo Coronel** — Analista Desarrollador | Full Stack

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Enzo%20Coronel-blue?logo=linkedin)](https://www.linkedin.com/in/enzo-coronel-b1234a322)
[![GitHub](https://img.shields.io/badge/GitHub-troche--bit-black?logo=github)](https://github.com/troche-bit)

---

## Licencia

© 2025 Enzo Coronel. Proyecto de tesis académica.
El código fuente está disponible para revisión con fines educativos.
Queda prohibida su reproducción total o parcial sin autorización del autor.
