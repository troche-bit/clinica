# Especificaciones de Casos de Uso — Módulo Usuarios
**Sistema:** Clínica Lichi  
**Módulo:** Administración → Usuarios y Roles  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total al módulo. Único que puede gestionar usuarios ajenos. |
| **Usuario autenticado** | Cualquier usuario con sesión activa (admin, médico, recepcionista, secretaria_médico). Puede cambiar su propia contraseña y consultar su perfil. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-USU-001 | Iniciar sesión | Usuario autenticado |
| CUS-USU-002 | Cerrar sesión | Usuario autenticado |
| CUS-USU-003 | Listar y filtrar usuarios | Administrador |
| CUS-USU-004 | Crear usuario | Administrador |
| CUS-USU-005 | Editar datos de usuario | Administrador |
| CUS-USU-006 | Activar / Desactivar usuario | Administrador |
| CUS-USU-007 | Resetear contraseña de usuario | Administrador |
| CUS-USU-008 | Cambiar contraseña propia | Usuario autenticado |

---

## CUS-USU-001 — Iniciar sesión

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-001 |
| **Módulo** | Usuarios |
| **Nombre** | Iniciar sesión |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario proporciona sus credenciales para autenticarse en el sistema y obtener un token JWT que habilita el acceso a los recursos protegidos. |
| **Pre-condición** | El usuario existe en el sistema y tiene un perfil activo (`activo = True`). |
| **Flujo básico** | 1. El usuario ingresa su nombre de usuario y contraseña en la pantalla de login. <br>2. El sistema valida las credenciales contra la base de datos. <br>3. El sistema verifica que el perfil del usuario esté activo. <br>4. El sistema genera un par de tokens JWT (access + refresh) con los datos del perfil embebidos (rol, nombre, iniciales, persona_rrhh_id, medicos_asignados). <br>5. Los tokens se almacenan en `localStorage` (`access_token` / `refresh_token`). <br>6. El sistema redirige al usuario al módulo correspondiente según su rol: admin → `/informes/dashboard/prestadores`; médico / secretaria_médico → `/consultas`. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Credenciales incorrectas:** El sistema retorna HTTP 401. Se muestra el mensaje "No active account found with the given credentials". <br>**E2 – Usuario desactivado:** El sistema retorna HTTP 401 con el mensaje "Usuario desactivado. Contacte al administrador." |
| **Reglas de negocio** | RN-01: La contraseña se valida con el hash almacenado en `auth_user` (Django). <br>RN-02: Solo los usuarios con `activo = True` pueden autenticarse. <br>RN-03: El token de acceso incluye: `rol`, `nombre`, `iniciales`, `activo`, `persona_rrhh_id`, `medicos_asignados`. |
| **Post-condición** | El usuario está autenticado. Los tokens JWT están disponibles en `localStorage`. |

---

## CUS-USU-002 — Cerrar sesión

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-002 |
| **Módulo** | Usuarios |
| **Nombre** | Cerrar sesión |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario finaliza su sesión activa. El token de refresh es invalidado en la lista negra del servidor y los tokens locales son eliminados del navegador. |
| **Pre-condición** | El usuario tiene una sesión activa con tokens JWT válidos en `localStorage`. |
| **Flujo básico** | 1. El usuario hace clic en "Cerrar sesión" desde el sidebar. <br>2. El frontend envía el refresh token al endpoint de blacklist (`/api/auth/token/blacklist/`). <br>3. El servidor agrega el refresh token a la blacklist (SimpleJWT Blacklist). <br>4. El frontend elimina `access_token` y `refresh_token` de `localStorage`. <br>5. El sistema redirige al usuario a la pantalla de login. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al invalidar el token en el servidor:** El frontend elimina los tokens locales de todas formas y redirige al login. |
| **Reglas de negocio** | RN-04: La invalidación del refresh token en el servidor previene la reutilización del token tras el cierre de sesión. |
| **Post-condición** | La sesión está terminada. El refresh token no puede usarse nuevamente. El usuario es redirigido a `/login`. |

---

## CUS-USU-003 — Listar y filtrar usuarios

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-003 |
| **Módulo** | Usuarios |
| **Nombre** | Listar y filtrar usuarios |
| **Actor** | Administrador |
| **Descripción** | El administrador visualiza la lista de todos los perfiles de usuario del sistema y puede filtrarla por texto de búsqueda, rol o estado activo/inactivo. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador navega a la sección Usuarios desde el sidebar. <br>2. El sistema consulta `GET /api/usuarios/` y devuelve todos los perfiles ordenados por nombre de usuario. <br>3. El sistema muestra la lista con columnas: usuario, nombre completo, rol, estado (activo/inactivo). <br>4. El administrador puede aplicar filtros: campo de búsqueda libre (username, nombre, apellido), selector de rol, selector de estado. <br>5. La lista se actualiza dinámicamente con los resultados filtrados. |
| **Flujo alterno** | **A1 – Sin resultados:** El sistema muestra el mensaje "Sin usuarios que coincidan con los filtros." |
| **Flujo de excepción** | **E1 – Error de red:** El sistema muestra un toast de error. |
| **Reglas de negocio** | RN-05: Solo el rol `admin` puede acceder al listado de usuarios. <br>RN-06: La búsqueda filtra por `username`, `first_name` o `last_name` (OR). <br>RN-07: El usuario master (superuser) aparece en la lista pero tiene restricciones de edición. |
| **Post-condición** | Se muestra la lista de usuarios con los filtros aplicados. |

---

## CUS-USU-004 — Crear usuario

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-004 |
| **Módulo** | Usuarios |
| **Nombre** | Crear usuario |
| **Actor** | Administrador |
| **Descripción** | El administrador registra un nuevo usuario en el sistema, asignándole credenciales, datos personales, rol y (si corresponde) vinculación con un prestador o médicos asignados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador hace clic en "Nuevo usuario". <br>2. El sistema muestra el modal de creación con los campos: usuario*, contraseña*, nombre, apellido, email, rol*, prestador RRHH (opcional), médicos asignados (solo si rol = secretaria_médico). <br>3. El administrador completa los campos requeridos y confirma. <br>4. El sistema envía `POST /api/usuarios/` con los datos. <br>5. El sistema crea el registro en `auth_user` y el `PerfilUsuario` asociado. <br>6. El modal se cierra y el nuevo usuario aparece en la lista. Se muestra un toast de confirmación. |
| **Flujo alterno** | **A1 – Rol = secretaria_médico:** El formulario habilita el campo de selección múltiple de médicos asignados. <br>**A2 – Rol ≠ secretaria_médico:** El campo `medicos_asignados` se ignora; el sistema lo vacía automáticamente. |
| **Flujo de excepción** | **E1 – Username duplicado:** El sistema retorna HTTP 400 con el mensaje "Ya existe un usuario con ese nombre de usuario." <br>**E2 – Username con espacios:** El sistema retorna HTTP 400 con el mensaje "El nombre de usuario no puede contener espacios." <br>**E3 – Contraseña menor a 8 caracteres:** El sistema retorna HTTP 400 (validación de longitud mínima). <br>**E4 – Campos requeridos vacíos:** El sistema muestra errores de validación campo por campo. |
| **Reglas de negocio** | RN-08: El username se convierte automáticamente a minúsculas y se eliminan espacios extremos antes de guardarse. <br>RN-09: La contraseña mínima es de 8 caracteres. <br>RN-10: El campo email es opcional pero, si se proporciona, debe tener formato válido. <br>RN-11: El campo `medicos_asignados` solo aplica para el rol `secretaria_médico`; se ignora para los demás roles. <br>RN-12: Todos los usuarios nuevos quedan con `activo = True` por defecto. |
| **Post-condición** | El nuevo usuario existe en `auth_user` y `users_perfilusuario`. Puede iniciar sesión con las credenciales proporcionadas. |

---

## CUS-USU-005 — Editar datos de usuario

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-005 |
| **Módulo** | Usuarios |
| **Nombre** | Editar datos de usuario |
| **Actor** | Administrador |
| **Descripción** | El administrador modifica los datos personales y/o el rol de un usuario existente. No incluye cambio de contraseña (que tiene su propio caso de uso). |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El usuario a editar existe en el sistema. |
| **Flujo básico** | 1. El administrador selecciona un usuario de la lista y hace clic en el ícono de edición. <br>2. El sistema muestra el modal con los datos actuales del usuario precargados. <br>3. El administrador modifica los campos deseados (nombre, apellido, email, rol, prestador, médicos asignados). <br>4. El administrador confirma los cambios. <br>5. El sistema envía `PATCH /api/usuarios/{id}/` con los datos modificados. <br>6. El sistema actualiza los registros en `auth_user` y `PerfilUsuario`. <br>7. El modal se cierra, la lista se actualiza y se muestra un toast de confirmación. |
| **Flujo alterno** | **A1 – Cambio de rol a secretaria_médico:** El sistema habilita el campo de médicos asignados y permite la selección. <br>**A2 – Cambio de rol desde secretaria_médico:** El sistema limpia automáticamente la lista de médicos asignados. |
| **Flujo de excepción** | **E1 – Intento de cambiar el rol del usuario master (superuser):** El sistema retorna HTTP 400 con el mensaje "No se puede cambiar el rol del usuario master." |
| **Reglas de negocio** | RN-13: No se puede editar el campo `username`; es inmutable tras la creación. <br>RN-14: El usuario master (`is_superuser = True`) no puede tener su rol modificado. <br>RN-15: La contraseña no se modifica desde este flujo; existe un caso de uso dedicado (CUS-USU-007). |
| **Post-condición** | Los datos del usuario quedan actualizados en la base de datos. El cambio queda registrado en la tabla de auditoría (`RegistroAuditoria`). |

---

## CUS-USU-006 — Activar / Desactivar usuario

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-006 |
| **Módulo** | Usuarios |
| **Nombre** | Activar / Desactivar usuario |
| **Actor** | Administrador |
| **Descripción** | El administrador cambia el estado activo/inactivo de un usuario. Un usuario inactivo no puede iniciar sesión. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El usuario a modificar existe y no es el usuario master ni el propio administrador. |
| **Flujo básico** | 1. El administrador localiza al usuario en la lista. <br>2. El administrador hace clic en el toggle de estado (activo/inactivo) junto al usuario. <br>3. El sistema envía `POST /api/usuarios/{id}/cambiar-estado/`. <br>4. El servidor invierte el campo `activo` del perfil (`True → False` o `False → True`). <br>5. La lista se actualiza mostrando el nuevo estado. Se muestra un toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Intento de desactivar al usuario master:** El sistema retorna HTTP 400 con el mensaje "No se puede desactivar al usuario master." <br>**E2 – Intento de desactivarse a sí mismo:** El sistema retorna HTTP 400 con el mensaje "No podés desactivarte a vos mismo." |
| **Reglas de negocio** | RN-16: El usuario master (`is_superuser = True`) no puede ser desactivado bajo ninguna circunstancia. <br>RN-17: Un administrador no puede desactivar su propia cuenta desde esta interfaz. <br>RN-18: Un usuario inactivo (`activo = False`) recibe HTTP 401 al intentar iniciar sesión, con el mensaje "Usuario desactivado. Contacte al administrador." |
| **Post-condición** | El campo `activo` del `PerfilUsuario` queda invertido. El cambio queda registrado en auditoría. Si el usuario fue desactivado, no podrá iniciar sesión hasta ser reactivado. |

---

## CUS-USU-007 — Resetear contraseña de usuario

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-007 |
| **Módulo** | Usuarios |
| **Nombre** | Resetear contraseña de usuario |
| **Actor** | Administrador |
| **Descripción** | El administrador establece una nueva contraseña para un usuario que no puede o no recuerda su contraseña actual. No requiere conocer la contraseña anterior. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El usuario destinatario existe en el sistema. |
| **Flujo básico** | 1. El administrador selecciona un usuario de la lista y hace clic en la opción "Resetear contraseña". <br>2. El sistema muestra un modal solicitando la nueva contraseña (con confirmación e indicador de fortaleza). <br>3. El administrador ingresa la nueva contraseña y la confirma. <br>4. El sistema envía `POST /api/usuarios/{id}/resetear-password/` con la nueva contraseña. <br>5. El servidor valida la longitud y que no sea igual a la contraseña actual. <br>6. El servidor actualiza el hash de contraseña en `auth_user`. <br>7. El modal se cierra y se muestra un toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Contraseña menor a 8 caracteres:** El sistema retorna HTTP 400 con el mensaje "La contraseña debe tener al menos 8 caracteres." <br>**E2 – Nueva contraseña igual a la actual:** El sistema retorna HTTP 400 con el mensaje "La nueva contraseña no puede ser igual a la actual." <br>**E3 – Contraseñas no coinciden (validación frontend):** El frontend bloquea el envío y muestra advertencia de no coincidencia. |
| **Reglas de negocio** | RN-19: El administrador no necesita conocer la contraseña actual del usuario para resetearla. <br>RN-20: La nueva contraseña debe tener al menos 8 caracteres. <br>RN-21: La nueva contraseña no puede ser idéntica a la contraseña vigente del usuario. <br>RN-22: El modal incluye indicador de fortaleza de contraseña (Débil / Media / Fuerte) y campo de confirmación con validación en tiempo real. |
| **Post-condición** | La contraseña del usuario queda actualizada. El cambio queda registrado en auditoría con la nota "reseteada por administrador: {username_admin}". El usuario deberá usar la nueva contraseña en su próximo inicio de sesión. |

---

## CUS-USU-008 — Cambiar contraseña propia

| Campo | Detalle |
|---|---|
| **ID** | CUS-USU-008 |
| **Módulo** | Usuarios |
| **Nombre** | Cambiar contraseña propia |
| **Actor** | Usuario autenticado |
| **Descripción** | Cualquier usuario autenticado puede cambiar su propia contraseña desde el dropdown de perfil en el sidebar, sin intervención del administrador. Requiere conocer la contraseña actual. |
| **Pre-condición** | El usuario está autenticado con cualquier rol válido. |
| **Flujo básico** | 1. El usuario hace clic en su nombre/avatar en la parte inferior del sidebar. <br>2. El sistema despliega un menú con la opción "Cambiar contraseña". <br>3. El usuario hace clic en "Cambiar contraseña". <br>4. El sistema muestra un modal con tres campos: contraseña actual, nueva contraseña (con indicador de fortaleza), confirmación de nueva contraseña. <br>5. El usuario completa los tres campos y confirma. <br>6. El sistema envía `POST /api/usuarios/cambiar-password/` con `current_password` y `nueva_password`. <br>7. El servidor valida la contraseña actual, la longitud mínima y que no sea igual a la actual. <br>8. El servidor actualiza el hash de contraseña. <br>9. El modal se cierra y se muestra un toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Contraseña actual incorrecta:** El sistema retorna HTTP 400 con el mensaje "La contraseña actual es incorrecta." <br>**E2 – Nueva contraseña menor a 8 caracteres:** El sistema retorna HTTP 400 con el mensaje "La contraseña debe tener al menos 8 caracteres." <br>**E3 – Nueva contraseña igual a la actual:** El sistema retorna HTTP 400 con el mensaje "La nueva contraseña no puede ser igual a la actual." <br>**E4 – Contraseñas nuevas no coinciden (validación frontend):** El frontend bloquea el envío y muestra la advertencia de no coincidencia en tiempo real. |
| **Reglas de negocio** | RN-23: El usuario debe conocer y proporcionar su contraseña actual para poder cambiarla. <br>RN-24: La nueva contraseña debe tener al menos 8 caracteres. <br>RN-25: La nueva contraseña no puede ser idéntica a la vigente. <br>RN-26: Este caso de uso está disponible para todos los roles (no exclusivo de admin). |
| **Post-condición** | La contraseña del usuario queda actualizada. El cambio queda registrado en auditoría con la nota "modificada por el propio usuario". La sesión activa no se invalida. |
