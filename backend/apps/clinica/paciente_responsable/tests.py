from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.clinica.paciente_responsable.models import PacienteResponsable
from apps.administracion.persona.models import TipoDocumento, Persona
from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_persona(nro_documento, razon_social, tipo_doc):
    return Persona.objects.create(
        tipo_documento=tipo_doc,
        nro_documento=nro_documento,
        razon_social=razon_social,
    )


class BasePacienteResponsable(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('pr_admin',  'admin')
        self.recep  = crear_usuario('pr_recep',  'recepcionista')
        self.medico = crear_usuario('pr_medico', 'medico')
        self.tipo_doc   = TipoDocumento.objects.create(descripcion='CI Responsable Test')
        self.persona    = crear_persona('RESP001', 'Rodríguez, Carmen', self.tipo_doc)
        self.responsable = PacienteResponsable.objects.create(
            persona=self.persona,
            es_contacto_emergencia=True,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PacienteResponsablePermisosTest(BasePacienteResponsable):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/pacienteresponsable/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/pacienteresponsable/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/pacienteresponsable/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_buscar(self):
        r = self.client.get('/api/pacienteresponsable/buscar/?nro_documento=RESP001')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/pacienteresponsable/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/pacienteresponsable/{self.responsable.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_buscar(self):
        self.auth(self.medico)
        r = self.client.get('/api/pacienteresponsable/buscar/?nro_documento=RESP001')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        p = crear_persona('RESP_MED_NO', 'Médico No', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {'persona': p.id})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/pacienteresponsable/{self.responsable.id}/', {'ocupacion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/pacienteresponsable/{self.responsable.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/pacienteresponsable/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/pacienteresponsable/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        p = crear_persona('RESP_RECEP_SI', 'Recep Puede', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {'persona': p.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(
            f'/api/pacienteresponsable/{self.responsable.id}/', {'ocupacion': 'Docente'}
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/pacienteresponsable/{self.responsable.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/pacienteresponsable/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        p = crear_persona('RESP_ADMIN_DEL', 'Admin Eliminar', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/pacienteresponsable/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class PacienteResponsableCrudTest(BasePacienteResponsable):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        p = crear_persona('RESP_BORRA', 'Para Borrar', self.tipo_doc)
        resp_borrado = PacienteResponsable.objects.create(persona=p)
        resp_borrado.soft_delete()
        r = self.client.get('/api/pacienteresponsable/')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.responsable.id, ids)
        self.assertNotIn(resp_borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/pacienteresponsable/')
        item = next(p for p in r.data['results'] if p['id'] == self.responsable.id)
        for campo in ['id', 'nombre', 'documento', 'telefono', 'persona_detalle']:
            self.assertIn(campo, item)

    def test_list_busqueda_por_razon_social(self):
        r = self.client.get('/api/pacienteresponsable/?search=Rodríguez')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.responsable.id, ids)

    def test_list_busqueda_por_nro_documento(self):
        r = self.client.get('/api/pacienteresponsable/?search=RESP001')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.responsable.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_responsable(self):
        r = self.client.get(f'/api/pacienteresponsable/{self.responsable.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['documento'], 'RESP001')

    def test_retrieve_eliminado_retorna_404(self):
        p = crear_persona('RESP_FANTAS', 'Fantasma', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        resp.soft_delete()
        r = self.client.get(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_retorna_404(self):
        r = self.client.get('/api/pacienteresponsable/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimo_valido(self):
        p = crear_persona('RESP002', 'López, Pedro', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {'persona': p.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_es_contacto_emergencia_explicito_true(self):
        p = crear_persona('RESP003', 'Test Contacto', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {
            'persona': p.id,
            'es_contacto_emergencia': True,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r.data['es_contacto_emergencia'])

    def test_create_con_campos_opcionales(self):
        p = crear_persona('RESP004', 'Completo Test', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {
            'persona': p.id,
            'grupo_sanguineo': 'A+',
            'ocupacion': 'Contador',
            'es_contacto_emergencia': True,
            'observacion': 'Observación de prueba',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['grupo_sanguineo'], 'A+')
        self.assertEqual(r.data['ocupacion'], 'Contador')

    def test_create_sin_persona_retorna_400(self):
        r = self.client.post('/api/pacienteresponsable/', {'ocupacion': 'Sin Persona'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_persona_ya_tiene_responsable_activo_retorna_400(self):
        r = self.client.post('/api/pacienteresponsable/', {'persona': self.persona.id})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_grupo_sanguineo_invalido_retorna_400(self):
        p = crear_persona('RESP_GS_INV', 'Grupo Invalido', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {
            'persona': p.id,
            'grupo_sanguineo': 'C+',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_strip_campos_texto(self):
        p = crear_persona('RESP_STRIP', 'Strip Test', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {
            'persona': p.id,
            'ocupacion': '  Médico  ',
            'observacion': '  Con espacios  ',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['ocupacion'], 'Médico')
        self.assertEqual(r.data['observacion'], 'Con espacios')

    def test_create_reutiliza_persona_tras_borrado_logico(self):
        p = crear_persona('RESP_REUTIL', 'Reutilizable', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        resp.soft_delete()
        r = self.client.post('/api/pacienteresponsable/', {'persona': p.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_ocupacion(self):
        r = self.client.patch(
            f'/api/pacienteresponsable/{self.responsable.id}/', {'ocupacion': 'Abogada'}
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.responsable.refresh_from_db()
        self.assertEqual(self.responsable.ocupacion, 'Abogada')

    def test_patch_es_contacto_emergencia(self):
        r = self.client.patch(
            f'/api/pacienteresponsable/{self.responsable.id}/', {'es_contacto_emergencia': False}
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.responsable.refresh_from_db()
        self.assertFalse(self.responsable.es_contacto_emergencia)

    def test_patch_grupo_sanguineo(self):
        r = self.client.patch(
            f'/api/pacienteresponsable/{self.responsable.id}/', {'grupo_sanguineo': 'O-'}
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.responsable.refresh_from_db()
        self.assertEqual(self.responsable.grupo_sanguineo, 'O-')

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_sin_pacientes_marca_is_deleted(self):
        p = crear_persona('RESP_DEL', 'Para Eliminar', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        resp.refresh_from_db()
        self.assertTrue(resp.is_deleted)
        self.assertIsNotNone(resp.fecha_eliminacion)

    def test_destroy_eliminado_retorna_404(self):
        p = crear_persona('RESP_YA_DEL', 'Ya Eliminado', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        resp.soft_delete()
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        p = crear_persona('RESP_ELIM', 'Para Eliminados', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        resp.soft_delete()
        r = self.client.get('/api/pacienteresponsable/eliminados/')
        ids = [item['id'] for item in r.data]
        self.assertIn(resp.id, ids)
        self.assertNotIn(self.responsable.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/pacienteresponsable/eliminados/')
        self.assertIsInstance(r.data, list)

    # ── Buscar ────────────────────────────────────────────────────────────────

    def test_buscar_responsable_existente(self):
        r = self.client.get('/api/pacienteresponsable/buscar/?nro_documento=RESP001')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(r.data['persona'])
        self.assertTrue(r.data['es_responsable'])
        self.assertIsNotNone(r.data['pacienteresponsable'])

    def test_buscar_persona_sin_responsable(self):
        p = crear_persona('RESP_SIN', 'Sin Responsable', self.tipo_doc)
        r = self.client.get(f'/api/pacienteresponsable/buscar/?nro_documento=RESP_SIN')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(r.data['persona'])
        self.assertFalse(r.data['es_responsable'])
        self.assertIsNone(r.data['pacienteresponsable'])

    def test_buscar_inexistente_devuelve_persona_none(self):
        r = self.client.get('/api/pacienteresponsable/buscar/?nro_documento=NOEXISTE999')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNone(r.data['persona'])
        self.assertFalse(r.data['es_responsable'])

    def test_buscar_sin_parametro_retorna_400(self):
        r = self.client.get('/api/pacienteresponsable/buscar/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Pacientes activos bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class PacienteResponsableConstraintTest(BasePacienteResponsable):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

        from apps.clinica.paciente.models import Paciente
        self.Paciente = Paciente

    def _crear_paciente(self, responsable, is_deleted=False):
        p = crear_persona(f'PAC_CONSTR_{responsable.id}', 'Paciente Constraint', self.tipo_doc)
        pac = self.Paciente.objects.create(
            persona=p, sexo='M', responsable=responsable
        )
        if is_deleted:
            pac.soft_delete()
        return pac

    def test_responsable_con_paciente_activo_no_puede_eliminarse(self):
        p = crear_persona('RESP_CON_PAC', 'Resp Con Paciente', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        self._crear_paciente(resp)
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        resp.refresh_from_db()
        self.assertFalse(resp.is_deleted)

    def test_error_menciona_pacientes_y_cantidad(self):
        p = crear_persona('RESP_ERR_MSG', 'Resp Error Msg', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        self._crear_paciente(resp)
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertIn('1', str(r.data))
        self.assertIn('paciente', str(r.data).lower())

    def test_responsable_con_solo_paciente_borrado_puede_eliminarse(self):
        p = crear_persona('RESP_PAC_BORR', 'Resp Pac Borrado', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        self._crear_paciente(resp, is_deleted=True)
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        resp.refresh_from_db()
        self.assertTrue(resp.is_deleted)

    def test_responsable_sin_pacientes_puede_eliminarse(self):
        p = crear_persona('RESP_SIN_PAC', 'Resp Sin Pacientes', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_multiples_pacientes_bloquean_y_conteo_correcto(self):
        p = crear_persona('RESP_MULTI_PAC', 'Resp Multi', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)

        p1 = crear_persona('PAC_MULTI_1', 'Pac Multi 1', self.tipo_doc)
        p2 = crear_persona('PAC_MULTI_2', 'Pac Multi 2', self.tipo_doc)
        self.Paciente.objects.create(persona=p1, sexo='M', responsable=resp)
        self.Paciente.objects.create(persona=p2, sexo='F', responsable=resp)

        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('2', str(r.data))


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class PacienteResponsableAuditoriaTest(BasePacienteResponsable):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        p = crear_persona('RESP_AUD_C', 'Audit Crear', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {'persona': p.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PacienteResponsable')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(
            f'/api/pacienteresponsable/{self.responsable.id}/', {'ocupacion': 'Audit Edit'}
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PacienteResponsable')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        p = crear_persona('RESP_AUD_D', 'Audit Delete', self.tipo_doc)
        resp = PacienteResponsable.objects.create(persona=p)
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/pacienteresponsable/{resp.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PacienteResponsable')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        p = crear_persona('RESP_AUD_U', 'Audit Usuario', self.tipo_doc)
        r = self.client.post('/api/pacienteresponsable/', {'persona': p.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_no_nulos(self):
        r = self.client.patch(
            f'/api/pacienteresponsable/{self.responsable.id}/',
            {'observacion': 'Audit Snapshots'}
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
