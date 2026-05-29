from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import PerfilUsuario

User = get_user_model()


def crear_usuario(username, password='Pass1234!', rol='recepcionista', activo=True, is_superuser=False):
    """Crea User + PerfilUsuario. El signal crea el perfil automáticamente."""
    if is_superuser:
        user = User.objects.create_superuser(username=username, password=password)
    else:
        user = User.objects.create_user(username=username, password=password)
    perfil = user.perfil
    perfil.rol = rol
    perfil.activo = activo
    perfil.save()
    return user, perfil


# ── Permisos ──────────────────────────────────────────────────────────────────

class PermisosTest(APITestCase):

    def setUp(self):
        self.admin, _ = crear_usuario('admin_perm', rol='admin')
        self.recep, _ = crear_usuario('recep_perm', rol='recepcionista')

    def test_listado_sin_autenticacion_retorna_401(self):
        r = self.client.get('/api/usuarios/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_listado_con_rol_no_admin_retorna_403(self):
        self.client.force_authenticate(user=self.recep)
        r = self.client.get('/api/usuarios/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_crear_con_rol_no_admin_retorna_403(self):
        self.client.force_authenticate(user=self.recep)
        r = self.client.post('/api/usuarios/', {
            'username': 'nuevo', 'password': 'Pass1234!', 'rol': 'medico',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_cambiar_estado_con_rol_no_admin_retorna_403(self):
        self.client.force_authenticate(user=self.recep)
        r = self.client.post(f'/api/usuarios/{self.recep.perfil.id}/cambiar-estado/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_me_sin_autenticacion_retorna_401(self):
        r = self.client.get('/api/usuarios/me/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_cualquier_rol_autenticado_ok(self):
        self.client.force_authenticate(user=self.recep)
        r = self.client.get('/api/usuarios/me/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ── Listado y filtros ─────────────────────────────────────────────────────────

class ListadoTest(APITestCase):

    def setUp(self):
        self.admin, _ = crear_usuario('admin_lst', rol='admin')
        self.recep, _ = crear_usuario('recep_lst', rol='recepcionista')
        self.medico, _ = crear_usuario('medico_lst', rol='medico')
        self.client.force_authenticate(user=self.admin)

    def test_listado_devuelve_todos_los_usuarios(self):
        r = self.client.get('/api/usuarios/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(r.data), 3)

    def test_filtro_por_rol(self):
        r = self.client.get('/api/usuarios/?rol=medico')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for item in r.data:
            self.assertEqual(item['rol'], 'medico')

    def test_filtro_activo_true_excluye_inactivos(self):
        self.recep.perfil.activo = False
        self.recep.perfil.save()
        r = self.client.get('/api/usuarios/?activo=true')
        usernames = [item['username'] for item in r.data]
        self.assertNotIn('recep_lst', usernames)

    def test_filtro_activo_false_muestra_solo_inactivos(self):
        self.recep.perfil.activo = False
        self.recep.perfil.save()
        r = self.client.get('/api/usuarios/?activo=false')
        usernames = [item['username'] for item in r.data]
        self.assertIn('recep_lst', usernames)
        self.assertNotIn('admin_lst', usernames)

    def test_filtro_search_por_username(self):
        r = self.client.get('/api/usuarios/?search=medico_lst')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(any(item['username'] == 'medico_lst' for item in r.data))

    def test_filtro_search_por_nombre(self):
        self.medico.first_name = 'Carlos'
        self.medico.save()
        r = self.client.get('/api/usuarios/?search=Carlos')
        usernames = [item['username'] for item in r.data]
        self.assertIn('medico_lst', usernames)


# ── Creación ──────────────────────────────────────────────────────────────────

class CreacionTest(APITestCase):

    def setUp(self):
        self.admin, _ = crear_usuario('admin_cre', rol='admin')
        self.client.force_authenticate(user=self.admin)

    def test_crear_usuario_retorna_201(self):
        r = self.client.post('/api/usuarios/', {
            'username': 'nuevo_usr',
            'password': 'Pass1234!',
            'rol': 'recepcionista',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['username'], 'nuevo_usr')
        self.assertEqual(r.data['rol'], 'recepcionista')

    def test_crear_usuario_persiste_en_db(self):
        self.client.post('/api/usuarios/', {
            'username': 'persistido',
            'password': 'Pass1234!',
            'rol': 'medico',
        })
        self.assertTrue(User.objects.filter(username='persistido').exists())

    def test_crear_username_duplicado_retorna_400(self):
        crear_usuario('duplicado')
        r = self.client.post('/api/usuarios/', {
            'username': 'duplicado',
            'password': 'Pass1234!',
            'rol': 'medico',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_password_menor_a_8_caracteres_retorna_400(self):
        r = self.client.post('/api/usuarios/', {
            'username': 'usr_short',
            'password': '123',
            'rol': 'medico',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_rol_invalido_retorna_400(self):
        r = self.client.post('/api/usuarios/', {
            'username': 'usr_rol',
            'password': 'Pass1234!',
            'rol': 'director',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_rol_no_secretaria_ignora_medicos_asignados(self):
        r = self.client.post('/api/usuarios/', {
            'username': 'recep_new',
            'password': 'Pass1234!',
            'rol': 'recepcionista',
            'medicos_asignados': [],
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['medicos_asignados_ids'], [])

    def test_crear_username_con_espacios_internos_retorna_400(self):
        r = self.client.post('/api/usuarios/', {
            'username': 'juan perez',
            'password': 'Pass1234!',
            'rol': 'medico',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_crear_username_se_guarda_en_minusculas(self):
        r = self.client.post('/api/usuarios/', {
            'username': 'USUARIO_MAYUS',
            'password': 'Pass1234!',
            'rol': 'medico',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['username'], 'usuario_mayus')

    def test_crear_username_duplicado_case_insensitive_retorna_400(self):
        crear_usuario('existente')
        r = self.client.post('/api/usuarios/', {
            'username': 'EXISTENTE',
            'password': 'Pass1234!',
            'rol': 'medico',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


# ── Edición ───────────────────────────────────────────────────────────────────

class EdicionTest(APITestCase):

    def setUp(self):
        self.admin, _ = crear_usuario('admin_upd', rol='admin')
        self.recep, _ = crear_usuario('recep_upd', rol='recepcionista')
        self.superuser, _ = crear_usuario('master_upd', is_superuser=True)
        self.client.force_authenticate(user=self.admin)

    def test_editar_nombre_ok(self):
        r = self.client.patch(f'/api/usuarios/{self.recep.perfil.id}/', {
            'first_name': 'Juan',
            'last_name': 'Pérez',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['first_name'], 'Juan')
        self.assertEqual(r.data['last_name'], 'Pérez')

    def test_editar_rol_del_superuser_retorna_400(self):
        r = self.client.patch(f'/api/usuarios/{self.superuser.perfil.id}/', {
            'rol': 'recepcionista',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_editar_email_ok(self):
        r = self.client.patch(f'/api/usuarios/{self.recep.perfil.id}/', {
            'email': 'nuevo@email.com',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['email'], 'nuevo@email.com')


# ── Endpoint /me/ ─────────────────────────────────────────────────────────────

class MeTest(APITestCase):

    def setUp(self):
        self.user, _ = crear_usuario('me_usr', rol='medico')
        self.client.force_authenticate(user=self.user)

    def test_me_retorna_perfil_propio(self):
        r = self.client.get('/api/usuarios/me/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['username'], 'me_usr')
        self.assertEqual(r.data['rol'], 'medico')

    def test_me_incluye_campo_activo(self):
        r = self.client.get('/api/usuarios/me/')
        self.assertIn('activo', r.data)
        self.assertTrue(r.data['activo'])


# ── Cambio de contraseña (propio usuario) ─────────────────────────────────────

class CambiarPasswordTest(APITestCase):

    def setUp(self):
        self.user, _ = crear_usuario('pass_usr', password='OldPass1!')
        self.client.force_authenticate(user=self.user)

    def test_cambio_exitoso(self):
        r = self.client.post('/api/usuarios/cambiar-password/', {
            'current_password': 'OldPass1!',
            'nueva_password': 'NewPass2@',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('NewPass2@'))

    def test_password_actual_incorrecta_retorna_400(self):
        r = self.client.post('/api/usuarios/cambiar-password/', {
            'current_password': 'Incorrecta!',
            'nueva_password': 'NewPass2@',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nueva_igual_a_actual_retorna_400(self):
        r = self.client.post('/api/usuarios/cambiar-password/', {
            'current_password': 'OldPass1!',
            'nueva_password': 'OldPass1!',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nueva_menor_a_8_caracteres_retorna_400(self):
        r = self.client.post('/api/usuarios/cambiar-password/', {
            'current_password': 'OldPass1!',
            'nueva_password': '123',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_password_no_cambia_si_hay_error(self):
        self.client.post('/api/usuarios/cambiar-password/', {
            'current_password': 'Incorrecta!',
            'nueva_password': 'NewPass2@',
        })
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('OldPass1!'))


# ── Cambio de estado (admin) ──────────────────────────────────────────────────

class CambiarEstadoTest(APITestCase):

    def setUp(self):
        self.admin, _ = crear_usuario('admin_est', rol='admin')
        self.target, _ = crear_usuario('target_est', rol='recepcionista')
        self.superuser, _ = crear_usuario('master_est', is_superuser=True)
        self.client.force_authenticate(user=self.admin)

    def test_toggle_activo_a_inactivo(self):
        r = self.client.post(f'/api/usuarios/{self.target.perfil.id}/cambiar-estado/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.target.perfil.refresh_from_db()
        self.assertFalse(self.target.perfil.activo)

    def test_toggle_inactivo_a_activo(self):
        self.target.perfil.activo = False
        self.target.perfil.save()
        r = self.client.post(f'/api/usuarios/{self.target.perfil.id}/cambiar-estado/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.target.perfil.refresh_from_db()
        self.assertTrue(self.target.perfil.activo)

    def test_no_puede_desactivar_superuser(self):
        r = self.client.post(f'/api/usuarios/{self.superuser.perfil.id}/cambiar-estado/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_puede_desactivarse_a_si_mismo(self):
        r = self.client.post(f'/api/usuarios/{self.admin.perfil.id}/cambiar-estado/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_estado_persiste_en_db(self):
        self.client.post(f'/api/usuarios/{self.target.perfil.id}/cambiar-estado/')
        desde_db = PerfilUsuario.objects.get(pk=self.target.perfil.id)
        self.assertFalse(desde_db.activo)


# ── Reset de contraseña (admin) ───────────────────────────────────────────────

class ResetearPasswordTest(APITestCase):

    def setUp(self):
        self.admin, _ = crear_usuario('admin_rst', rol='admin')
        self.target, _ = crear_usuario('target_rst', password='OldPass1!')
        self.client.force_authenticate(user=self.admin)

    def test_resetear_password_ok(self):
        r = self.client.post(f'/api/usuarios/{self.target.perfil.id}/resetear-password/', {
            'nueva_password': 'NewReset2@',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.target.refresh_from_db()
        self.assertTrue(self.target.check_password('NewReset2@'))

    def test_nueva_igual_a_actual_retorna_400(self):
        r = self.client.post(f'/api/usuarios/{self.target.perfil.id}/resetear-password/', {
            'nueva_password': 'OldPass1!',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_nueva_menor_a_8_caracteres_retorna_400(self):
        r = self.client.post(f'/api/usuarios/{self.target.perfil.id}/resetear-password/', {
            'nueva_password': '123',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reset_por_no_admin_retorna_403(self):
        recep, _ = crear_usuario('recep_rst', rol='recepcionista')
        self.client.force_authenticate(user=recep)
        r = self.client.post(f'/api/usuarios/{self.target.perfil.id}/resetear-password/', {
            'nueva_password': 'NewReset2@',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


# ── Login JWT ─────────────────────────────────────────────────────────────────

class LoginTest(APITestCase):

    def setUp(self):
        self.user, self.perfil = crear_usuario('login_usr', password='Pass1234!', rol='medico')

    def test_login_exitoso_devuelve_tokens(self):
        r = self.client.post('/api/auth/token/', {
            'username': 'login_usr',
            'password': 'Pass1234!',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('access', r.data)
        self.assertIn('refresh', r.data)

    def test_credenciales_incorrectas_retornan_401(self):
        r = self.client.post('/api/auth/token/', {
            'username': 'login_usr',
            'password': 'Incorrecta!',
        })
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_usuario_inexistente_retorna_401(self):
        r = self.client.post('/api/auth/token/', {
            'username': 'no_existe',
            'password': 'Pass1234!',
        })
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_usuario_inactivo_retorna_401(self):
        self.perfil.activo = False
        self.perfil.save()
        r = self.client.post('/api/auth/token/', {
            'username': 'login_usr',
            'password': 'Pass1234!',
        })
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
