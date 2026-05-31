from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.clinica.configuracion.consultorio.models import Consultorio
from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


class BaseConsultorio(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('con_admin',  'admin')
        self.recep  = crear_usuario('con_recep',  'recepcionista')
        self.medico = crear_usuario('con_medico', 'medico')
        self.cons   = Consultorio.objects.create(nro_consultorio='Consultorio 1')

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosTest(BaseConsultorio):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/consultorio/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'X'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/consultorio/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/consultorio/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/consultorio/{self.cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'Médico No'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'nro_consultorio': 'Médico Edit'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/consultorio/{self.cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/consultorio/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/consultorio/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'Consultorio R'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'nro_consultorio': 'Consultorio R Edit'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/consultorio/{self.cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/consultorio/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        cons = Consultorio.objects.create(nro_consultorio='Para Eliminar')
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/consultorio/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class ConsultorioCrudTest(BaseConsultorio):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrado = Consultorio.objects.create(nro_consultorio='Borrado')
        borrado.soft_delete()
        r = self.client.get('/api/consultorio/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [c['id'] for c in r.data['results']]
        self.assertIn(self.cons.id, ids)
        self.assertNotIn(borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/consultorio/')
        item = next(c for c in r.data['results'] if c['id'] == self.cons.id)
        self.assertIn('id', item)
        self.assertIn('nro_consultorio', item)
        self.assertIn('descripcion', item)

    def test_list_busqueda_por_nro(self):
        Consultorio.objects.create(nro_consultorio='Consultorio ZZZ')
        r = self.client.get('/api/consultorio/?search=ZZZ')
        ids = [c['id'] for c in r.data['results']]
        self.assertTrue(all('ZZZ' in c['nro_consultorio'] for c in r.data['results']))

    def test_list_busqueda_por_descripcion(self):
        Consultorio.objects.create(nro_consultorio='C-99', descripcion='Pediatría especial')
        r = self.client.get('/api/consultorio/?search=Pediatría')
        ids = [c['id'] for c in r.data['results']]
        self.assertTrue(len(ids) >= 1)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_consultorio(self):
        r = self.client.get(f'/api/consultorio/{self.cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['nro_consultorio'], 'Consultorio 1')

    def test_retrieve_eliminado_devuelve_404(self):
        borrado = Consultorio.objects.create(nro_consultorio='Fantasma')
        borrado.soft_delete()
        r = self.client.get(f'/api/consultorio/{borrado.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/consultorio/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_solo_nro_requerido(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'Consultorio Nuevo'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_consultorio'], 'Consultorio Nuevo')

    def test_create_con_descripcion(self):
        r = self.client.post('/api/consultorio/', {
            'nro_consultorio': 'Consultorio Con Desc',
            'descripcion': 'Para consultas generales',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Para consultas generales')

    def test_create_descripcion_es_opcional(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'C Sin Desc'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(r.data['descripcion'])

    def test_create_strip_espacios(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': '  Consultorio Trim  '})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_consultorio'], 'Consultorio Trim')

    def test_create_duplicado_exacto_retorna_400(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'Consultorio 1'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_case_insensitive_retorna_400(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'consultorio 1'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_mayusculas_retorna_400(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'CONSULTORIO 1'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_nro_vacio_retorna_400(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': ''})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_nro_retorna_400(self):
        r = self.client.post('/api/consultorio/', {'descripcion': 'Sin número'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_nombre_reutilizable_tras_borrado_logico(self):
        temp = Consultorio.objects.create(nro_consultorio='Reutilizable')
        temp.soft_delete()
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'Reutilizable'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_nro_consultorio(self):
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'nro_consultorio': 'Consultorio 1 Mod'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.cons.refresh_from_db()
        self.assertEqual(self.cons.nro_consultorio, 'Consultorio 1 Mod')

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'descripcion': 'Nueva descripción'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.cons.refresh_from_db()
        self.assertEqual(self.cons.descripcion, 'Nueva descripción')

    def test_patch_mismo_nro_no_falla(self):
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'nro_consultorio': 'Consultorio 1'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_nro_duplicado_de_otro_retorna_400(self):
        otro = Consultorio.objects.create(nro_consultorio='Consultorio 2')
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'nro_consultorio': 'Consultorio 2'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted(self):
        cons = Consultorio.objects.create(nro_consultorio='Para Borrar')
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        cons.refresh_from_db()
        self.assertTrue(cons.is_deleted)
        self.assertIsNotNone(cons.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        cons = Consultorio.objects.create(nro_consultorio='Para Borrar 2')
        self.client.delete(f'/api/consultorio/{cons.id}/')
        r = self.client.get('/api/consultorio/')
        ids = [c['id'] for c in r.data['results']]
        self.assertNotIn(cons.id, ids)

    def test_destroy_eliminado_retorna_404(self):
        cons = Consultorio.objects.create(nro_consultorio='Ya Borrado')
        cons.soft_delete()
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        cons = Consultorio.objects.create(nro_consultorio='Para Eliminados')
        cons.soft_delete()
        r = self.client.get('/api/consultorio/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [c['id'] for c in r.data]
        self.assertIn(cons.id, ids)
        self.assertNotIn(self.cons.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/consultorio/eliminados/')
        self.assertIsInstance(r.data, list)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Horarios activos bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class ConsultorioConstraintTest(BaseConsultorio):
    """
    Verifica que un consultorio con horarios de prestador activos no puede
    eliminarse, y que un consultorio sin horarios activos sí puede.
    """

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        # Importar aquí para no añadir dependencias innecesarias en la clase base
        from apps.mantenimiento.diasemana.models import DiaSemana
        from apps.administracion.persona.models import TipoDocumento, Persona
        from apps.administracion.persona_rrhh.models import PersonaRRHH
        from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador

        self.HorarioPrestador = HorarioPrestador

        tipo_doc = TipoDocumento.objects.create(descripcion='CI')
        persona = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='77700001',
            razon_social='Prestador Test Consultorio',
        )
        self.rrhh = PersonaRRHH.objects.create(persona=persona)
        self.dia, _ = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})

    def _crear_horario(self, consultorio, is_deleted=False):
        h = self.HorarioPrestador.objects.create(
            persona_rrhh=self.rrhh,
            consultorio=consultorio,
            dia_semana=self.dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )
        if is_deleted:
            h.soft_delete()
        return h

    def test_consultorio_con_horario_activo_no_puede_eliminarse(self):
        cons = Consultorio.objects.create(nro_consultorio='C Con Horario')
        self._crear_horario(cons)
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        cons.refresh_from_db()
        self.assertFalse(cons.is_deleted)

    def test_error_menciona_horarios(self):
        cons = Consultorio.objects.create(nro_consultorio='C Con Horario 2')
        self._crear_horario(cons)
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertIn('horarios', str(r.data).lower())

    def test_consultorio_con_solo_horario_borrado_puede_eliminarse(self):
        cons = Consultorio.objects.create(nro_consultorio='C Horario Borrado')
        self._crear_horario(cons, is_deleted=True)
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        cons.refresh_from_db()
        self.assertTrue(cons.is_deleted)

    def test_consultorio_sin_horarios_puede_eliminarse(self):
        cons = Consultorio.objects.create(nro_consultorio='C Sin Horarios')
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class ConsultorioAuditoriaTest(BaseConsultorio):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'C Auditoria Crear'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Consultorio')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'descripcion': 'Auditado'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Consultorio')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        cons = Consultorio.objects.create(nro_consultorio='C Para Audit Delete')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/consultorio/{cons.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Consultorio')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/consultorio/', {'nro_consultorio': 'C Auditoria Usuario'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_datos_antes_y_despues_no_nulos(self):
        r = self.client.patch(f'/api/consultorio/{self.cons.id}/', {'descripcion': 'Desc Auditada'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
