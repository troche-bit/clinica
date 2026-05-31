from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.clinica.configuracion.especialidad.models import Especialidad
from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


class BaseEspecialidad(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('esp_admin',  'admin')
        self.recep  = crear_usuario('esp_recep',  'recepcionista')
        self.medico = crear_usuario('esp_medico', 'medico')
        self.esp    = Especialidad.objects.create(descripcion='Cardiología')

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosTest(BaseEspecialidad):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/especialidad/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/especialidad/', {'descripcion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/especialidad/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/especialidad/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/especialidad/{self.esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/especialidad/', {'descripcion': 'Neurología'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/especialidad/{self.esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/especialidad/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/especialidad/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/especialidad/', {'descripcion': 'Dermatología'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'Cardiología Edit'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/especialidad/{self.esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/especialidad/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        esp = Especialidad.objects.create(descripcion='Para Eliminar')
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/especialidad/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class EspecialidadCrudTest(BaseEspecialidad):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activas(self):
        borrada = Especialidad.objects.create(descripcion='Borrada')
        borrada.soft_delete()
        r = self.client.get('/api/especialidad/')
        ids = [e['id'] for e in r.data['results']]
        self.assertIn(self.esp.id, ids)
        self.assertNotIn(borrada.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/especialidad/')
        item = next(e for e in r.data['results'] if e['id'] == self.esp.id)
        self.assertIn('id', item)
        self.assertIn('descripcion', item)

    def test_list_busqueda_por_descripcion(self):
        Especialidad.objects.create(descripcion='Traumatología')
        r = self.client.get('/api/especialidad/?search=traumat')
        self.assertGreater(len(r.data['results']), 0)
        for e in r.data['results']:
            self.assertIn('traumat', e['descripcion'].lower())

    def test_list_ordenado_por_descripcion_ascendente(self):
        Especialidad.objects.create(descripcion='Anestesiología')
        r = self.client.get('/api/especialidad/')
        descs = [e['descripcion'] for e in r.data['results']]
        self.assertEqual(descs, sorted(descs, key=lambda d: d.lower()))

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_especialidad(self):
        r = self.client.get(f'/api/especialidad/{self.esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['descripcion'], 'Cardiología')

    def test_retrieve_eliminada_devuelve_404(self):
        borrada = Especialidad.objects.create(descripcion='Fantasma')
        borrada.soft_delete()
        r = self.client.get(f'/api/especialidad/{borrada.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/especialidad/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido(self):
        r = self.client.post('/api/especialidad/', {'descripcion': 'Neurología'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Neurología')

    def test_create_strip_espacios(self):
        r = self.client.post('/api/especialidad/', {'descripcion': '  Pediatría  '})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Pediatría')

    def test_create_duplicado_exacto_retorna_400(self):
        r = self.client.post('/api/especialidad/', {'descripcion': 'Cardiología'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_case_insensitive_retorna_400(self):
        r = self.client.post('/api/especialidad/', {'descripcion': 'cardiología'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_mayusculas_retorna_400(self):
        r = self.client.post('/api/especialidad/', {'descripcion': 'CARDIOLOGÍA'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_descripcion_vacia_retorna_400(self):
        r = self.client.post('/api/especialidad/', {'descripcion': ''})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_descripcion_retorna_400(self):
        r = self.client.post('/api/especialidad/', {})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_reutiliza_nombre_tras_borrado_logico(self):
        borrada = Especialidad.objects.create(descripcion='Reutilizable')
        borrada.soft_delete()
        r = self.client.post('/api/especialidad/', {'descripcion': 'Reutilizable'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_reutiliza_nombre_case_insensitive_tras_borrado(self):
        borrada = Especialidad.objects.create(descripcion='Oncología')
        borrada.soft_delete()
        r = self.client.post('/api/especialidad/', {'descripcion': 'ONCOLOGÍA'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'Cardiología Pediátrica'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.esp.refresh_from_db()
        self.assertEqual(self.esp.descripcion, 'Cardiología Pediátrica')

    def test_patch_mismo_nombre_no_falla(self):
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'Cardiología'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_mismo_nombre_case_insensitive_no_falla(self):
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'CARDIOLOGÍA'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_strip_espacios(self):
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': '  Cardiología Adultos  '})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.esp.refresh_from_db()
        self.assertEqual(self.esp.descripcion, 'Cardiología Adultos')

    def test_patch_duplicado_de_otra_retorna_400(self):
        Especialidad.objects.create(descripcion='Gastroenterología')
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'Gastroenterología'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted_y_fecha(self):
        esp = Especialidad.objects.create(descripcion='Para Borrar')
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        esp.refresh_from_db()
        self.assertTrue(esp.is_deleted)
        self.assertIsNotNone(esp.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        esp = Especialidad.objects.create(descripcion='Para Borrar 2')
        self.client.delete(f'/api/especialidad/{esp.id}/')
        r = self.client.get('/api/especialidad/')
        ids = [e['id'] for e in r.data['results']]
        self.assertNotIn(esp.id, ids)

    def test_destroy_eliminada_retorna_404(self):
        esp = Especialidad.objects.create(descripcion='Ya Borrada')
        esp.soft_delete()
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borradas(self):
        esp = Especialidad.objects.create(descripcion='Para Eliminados')
        esp.soft_delete()
        r = self.client.get('/api/especialidad/eliminados/')
        ids = [e['id'] for e in r.data]
        self.assertIn(esp.id, ids)
        self.assertNotIn(self.esp.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/especialidad/eliminados/')
        self.assertIsInstance(r.data, list)

    def test_eliminados_ordenados_por_descripcion(self):
        a = Especialidad.objects.create(descripcion='Zzz Borrada')
        b = Especialidad.objects.create(descripcion='Aaa Borrada')
        a.soft_delete()
        b.soft_delete()
        r = self.client.get('/api/especialidad/eliminados/')
        descs = [e['descripcion'] for e in r.data if e['descripcion'] in ('Zzz Borrada', 'Aaa Borrada')]
        self.assertEqual(descs, sorted(descs, key=lambda d: d.lower()))


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Prestadores activos bloquean el borrado (M2M)
# ══════════════════════════════════════════════════════════════════════════════

class EspecialidadConstraintTest(BaseEspecialidad):
    """
    Verifica que una especialidad con prestadores activos vinculados (M2M) no puede
    eliminarse, y que prestadores borrados lógicamente no bloquean el borrado.
    """

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

        from apps.administracion.persona.models import TipoDocumento, Persona
        from apps.administracion.persona_rrhh.models import PersonaRRHH

        self.PersonaRRHH = PersonaRRHH

        tipo_doc = TipoDocumento.objects.create(descripcion='CI')
        persona = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='88800001',
            razon_social='Prestador Test Especialidad',
        )
        self.rrhh = PersonaRRHH.objects.create(persona=persona)

    def test_especialidad_con_prestador_activo_no_puede_eliminarse(self):
        esp = Especialidad.objects.create(descripcion='Esp Con Prestador')
        self.rrhh.especialidades.add(esp)
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        esp.refresh_from_db()
        self.assertFalse(esp.is_deleted)

    def test_error_menciona_cantidad_de_prestadores(self):
        esp = Especialidad.objects.create(descripcion='Esp Conteo')
        self.rrhh.especialidades.add(esp)
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertIn('1', str(r.data))
        self.assertIn('prestador', str(r.data).lower())

    def test_multiples_prestadores_bloquean_y_conteo_correcto(self):
        from apps.administracion.persona.models import TipoDocumento, Persona
        tipo_doc = TipoDocumento.objects.get(descripcion='CI')
        persona2 = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='88800002',
            razon_social='Prestador Test 2',
        )
        rrhh2 = self.PersonaRRHH.objects.create(persona=persona2)

        esp = Especialidad.objects.create(descripcion='Esp Múltiples')
        self.rrhh.especialidades.add(esp)
        rrhh2.especialidades.add(esp)

        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('2', str(r.data))

    def test_especialidad_con_solo_prestador_borrado_puede_eliminarse(self):
        esp = Especialidad.objects.create(descripcion='Esp Prestador Borrado')
        self.rrhh.especialidades.add(esp)
        self.rrhh.soft_delete()
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        esp.refresh_from_db()
        self.assertTrue(esp.is_deleted)

    def test_especialidad_sin_prestadores_puede_eliminarse(self):
        esp = Especialidad.objects.create(descripcion='Esp Sin Prestadores')
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_prestador_sin_esta_especialidad_no_bloquea(self):
        # El prestador existe pero no tiene esta especialidad en su M2M
        otra_esp = Especialidad.objects.create(descripcion='Otra Especialidad')
        self.rrhh.especialidades.add(otra_esp)

        esp = Especialidad.objects.create(descripcion='Esp No Vinculada')
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class EspecialidadAuditoriaTest(BaseEspecialidad):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/especialidad/', {'descripcion': 'Audit Crear'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Especialidad')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'Audit Editar'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Especialidad')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        esp = Especialidad.objects.create(descripcion='Audit Delete')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/especialidad/{esp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Especialidad')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/especialidad/', {'descripcion': 'Audit Usuario'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_contienen_valores_correctos(self):
        r = self.client.patch(f'/api/especialidad/{self.esp.id}/', {'descripcion': 'Audit Snapshots'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
        self.assertIn('Cardiología', str(reg.datos_antes))
        self.assertIn('Audit Snapshots', str(reg.datos_despues))
