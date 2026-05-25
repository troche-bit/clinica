# Clínica Lichi — Sistema de Gestión Clínica

Sistema web completo desarrollado como proyecto de tesis de grado en
Ingeniería Informática.

## Descripción

Plataforma de gestión para clínica médica que cubre el flujo completo
de atención: registro de pacientes, gestión de turnos, historial clínico
y reportes administrativos.

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React |
| Backend | Django REST Framework (Python) |
| Base de datos | PostgreSQL |
| Autenticación | JWT |

## Características principales

- Gestión de pacientes y expedientes clínicos
- Sistema de turnos y agenda médica
- Reportes administrativos
- API REST documentada
- Diseño responsivo

## Arquitectura

El sistema fue diseñado desde cero, incluyendo:
- Modelado completo de base de datos relacional
- Diseño de API REST con Django REST Framework
- Arquitectura de componentes en React

## Instalación local

```bash
# Backend
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm start
```

## Estado del proyecto

🟡 En desarrollo final — deploy próximamente disponible

## Autor

**Enzo Coronel** — [LinkedIn](https://www.linkedin.com/in/enzo-coronel-b1234a322?utm_source=share_via&utm_content=profile&utm_medium=member_android) · [GitHub](https://github.com/troche-bit)
