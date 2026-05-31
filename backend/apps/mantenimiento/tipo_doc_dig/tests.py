from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.mantenimiento.tipo_doc_dig.models import TipoDocDigital
from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


class BaseTipoDocDig(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('tdd_admin',  'admin')
        self.recep  = crear_usuario('tdd_recep',  'recepcionista')
        self.medico = crear_usuario('tdd_medico', 'medico')
        self.tipo   = TipoDocDigital.objects.create(
            descripcion='Historia Clínica',
            storage_key='historia_clinica',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosTest(BaseTipoDocDig):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/tipo-doc-dig/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/tipo-doc-dig/', {'descripcion': 'X', 'storage_key': 'x'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/tipo-doc-dig/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/tipo-doc-dig/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/tipo-doc-dig/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/tipo-doc-dig/', {'descripcion': 'Receta', 'storage_key': 'receta'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'descripcion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/tipo-doc-dig/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/tipo-doc-dig/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/tipo-doc-dig/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/tipo-doc-dig/', {'descripcion': 'Receta Médica', 'storage_key': 'receta_medica'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'descripcion': 'Historia Edit'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/tipo-doc-dig/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/tipo-doc-dig/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        t = TipoDocDigital.objects.create(descripcion='Para Eliminar', storage_key='para_eliminar')
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/tipo-doc-dig/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class TipoDocDigCrudTest(BaseTipoDocDig):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrado = TipoDocDigital.objects.create(descripcion='Borrado', storage_key='borrado_key')
        borrado.soft_delete()
        r = self.client.get('/api/tipo-doc-dig/')
        ids = [t['id'] for t in r.data['results']]
        self.assertIn(self.tipo.id, ids)
        self.assertNotIn(borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/tipo-doc-dig/')
        item = next(t for t in r.data['results'] if t['id'] == self.tipo.id)
        self.assertIn('id', item)
        self.assertIn('descripcion', item)
        self.assertIn('storage_key', item)

    def test_list_busqueda_por_descripcion(self):
        TipoDocDigital.objects.create(descripcion='Consentimiento Informado', storage_key='consentimiento')
        r = self.client.get('/api/tipo-doc-dig/?search=consentimiento')
        self.assertGreater(len(r.data['results']), 0)
        for t in r.data['results']:
            self.assertIn('consentimiento', t['descripcion'].lower() + t['storage_key'].lower())

    def test_list_busqueda_por_storage_key(self):
        TipoDocDigital.objects.create(descripcion='Certificado Médico', storage_key='cert_medico')
        r = self.client.get('/api/tipo-doc-dig/?search=cert_medico')
        self.assertGreater(len(r.data['results']), 0)

    def test_list_ordenado_por_descripcion_ascendente(self):
        TipoDocDigital.objects.create(descripcion='Alta Médica', storage_key='alta_medica')
        r = self.client.get('/api/tipo-doc-dig/')
        descs = [t['descripcion'] for t in r.data['results']]
        self.assertEqual(descs, sorted(descs, key=lambda d: d.lower()))

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_tipo(self):
        r = self.client.get(f'/api/tipo-doc-dig/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['descripcion'], 'Historia Clínica')
        self.assertEqual(r.data['storage_key'], 'historia_clinica')

    def test_retrieve_eliminado_devuelve_404(self):
        borrado = TipoDocDigital.objects.create(descripcion='Fantasma', storage_key='fantasma_key')
        borrado.soft_delete()
        r = self.client.get(f'/api/tipo-doc-dig/{borrado.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/tipo-doc-dig/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido(self):
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Receta Médica',
            'storage_key': 'receta_medica',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Receta Médica')
        self.assertEqual(r.data['storage_key'], 'receta_medica')

    def test_create_strip_espacios_descripcion(self):
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': '  Informe Radiológico  ',
            'storage_key': 'informe_radiologico',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Informe Radiológico')

    def test_create_storage_key_normaliza_a_minusculas(self):
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Ecografía',
            'storage_key': 'ECOGRAFIA',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['storage_key'], 'ecografia')

    def test_create_descripcion_duplicada_retorna_400(self):
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Historia Clínica',
            'storage_key': 'otro_key',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_descripcion_duplicada_case_insensitive_retorna_400(self):
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'historia clínica',
            'storage_key': 'otro_key_2',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_storage_key_duplicado_retorna_400(self):
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Otro Tipo',
            'storage_key': 'historia_clinica',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_descripcion_retorna_400(self):
        r = self.client.post('/api/tipo-doc-dig/', {'storage_key': 'sin_desc'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_storage_key_retorna_400(self):
        r = self.client.post('/api/tipo-doc-dig/', {'descripcion': 'Sin Clave'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_reutiliza_descripcion_tras_borrado_logico(self):
        borrado = TipoDocDigital.objects.create(descripcion='Reutilizable', storage_key='reutilizable_key')
        borrado.soft_delete()
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Reutilizable',
            'storage_key': 'reutilizable_key_nuevo',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_reutiliza_storage_key_tras_borrado_logico(self):
        borrado = TipoDocDigital.objects.create(descripcion='Reutilizable Key', storage_key='key_reutilizable')
        borrado.soft_delete()
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Nuevo Con Key Reutilizable',
            'storage_key': 'key_reutilizable',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'descripcion': 'Historia Clínica Adultos'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.tipo.refresh_from_db()
        self.assertEqual(self.tipo.descripcion, 'Historia Clínica Adultos')

    def test_patch_misma_descripcion_no_falla(self):
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'descripcion': 'Historia Clínica'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_descripcion_duplicada_de_otro_retorna_400(self):
        TipoDocDigital.objects.create(descripcion='Receta', storage_key='receta_key')
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'descripcion': 'Receta'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_storage_key_es_ignorado(self):
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'storage_key': 'nuevo_key_ignorado'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.tipo.refresh_from_db()
        self.assertEqual(self.tipo.storage_key, 'historia_clinica')

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted_y_fecha(self):
        t = TipoDocDigital.objects.create(descripcion='Para Borrar', storage_key='para_borrar')
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        t.refresh_from_db()
        self.assertTrue(t.is_deleted)
        self.assertIsNotNone(t.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        t = TipoDocDigital.objects.create(descripcion='Para Borrar 2', storage_key='para_borrar_2')
        self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        r = self.client.get('/api/tipo-doc-dig/')
        ids = [item['id'] for item in r.data['results']]
        self.assertNotIn(t.id, ids)

    def test_destroy_eliminado_retorna_404(self):
        t = TipoDocDigital.objects.create(descripcion='Ya Borrado', storage_key='ya_borrado')
        t.soft_delete()
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        t = TipoDocDigital.objects.create(descripcion='Para Eliminados', storage_key='para_eliminados')
        t.soft_delete()
        r = self.client.get('/api/tipo-doc-dig/eliminados/')
        ids = [item['id'] for item in r.data]
        self.assertIn(t.id, ids)
        self.assertNotIn(self.tipo.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/tipo-doc-dig/eliminados/')
        self.assertIsInstance(r.data, list)

    def test_eliminados_incluye_descripcion_y_storage_key(self):
        t = TipoDocDigital.objects.create(descripcion='Elim Campos', storage_key='elim_campos')
        t.soft_delete()
        r = self.client.get('/api/tipo-doc-dig/eliminados/')
        item = next((e for e in r.data if e['id'] == t.id), None)
        self.assertIsNotNone(item)
        self.assertIn('descripcion', item)
        self.assertIn('storage_key', item)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Documentos activos (paciente Y prestador) bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class TipoDocDigConstraintTest(BaseTipoDocDig):
    """
    Verifica que un TipoDocDigital con documentos activos vinculados (de paciente
    o de prestador) no puede eliminarse, y que solo documentos borrados lógicamente
    no generan bloqueo.
    """

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

        from apps.administracion.persona.models import TipoDocumento, Persona
        from apps.clinica.paciente.models import Paciente
        from apps.administracion.persona_rrhh.models import PersonaRRHH
        from apps.clinica.configuracion.documentos.models import DocumentoDigPaciente, DocumentoDigPrestador

        self.DocumentoDigPaciente  = DocumentoDigPaciente
        self.DocumentoDigPrestador = DocumentoDigPrestador

        tipo_doc = TipoDocumento.objects.create(descripcion='CI')

        persona_pac = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='33300001',
            razon_social='Paciente Test TDD',
        )
        self.paciente = Paciente.objects.create(persona=persona_pac)

        persona_rrhh = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='33300002',
            razon_social='Prestador Test TDD',
        )
        self.rrhh = PersonaRRHH.objects.create(persona=persona_rrhh)

    def _crear_doc_paciente(self, tipo, is_deleted=False):
        d = self.DocumentoDigPaciente.objects.create(
            paciente=self.paciente,
            tipo_doc_dig=tipo,
            storage='docs/test.pdf',
            filename='test.pdf',
        )
        if is_deleted:
            d.soft_delete()
        return d

    def _crear_doc_prestador(self, tipo, is_deleted=False):
        d = self.DocumentoDigPrestador.objects.create(
            persona_rrhh=self.rrhh,
            tipo_doc_dig=tipo,
            storage='docs-prestador/test.pdf',
            filename='test.pdf',
        )
        if is_deleted:
            d.soft_delete()
        return d

    def test_tipo_con_doc_paciente_activo_no_puede_eliminarse(self):
        t = TipoDocDigital.objects.create(descripcion='Tipo Doc Pac', storage_key='tipo_doc_pac')
        self._crear_doc_paciente(t)
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        t.refresh_from_db()
        self.assertFalse(t.is_deleted)

    def test_tipo_con_doc_prestador_activo_no_puede_eliminarse(self):
        t = TipoDocDigital.objects.create(descripcion='Tipo Doc Prest', storage_key='tipo_doc_prest')
        self._crear_doc_prestador(t)
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        t.refresh_from_db()
        self.assertFalse(t.is_deleted)

    def test_error_menciona_documentos(self):
        t = TipoDocDigital.objects.create(descripcion='Tipo Error Msg', storage_key='tipo_error_msg')
        self._crear_doc_paciente(t)
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertIn('document', str(r.data).lower())

    def test_tipo_con_solo_docs_borrados_puede_eliminarse(self):
        t = TipoDocDigital.objects.create(descripcion='Tipo Docs Borrados', storage_key='tipo_docs_borr')
        self._crear_doc_paciente(t, is_deleted=True)
        self._crear_doc_prestador(t, is_deleted=True)
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        t.refresh_from_db()
        self.assertTrue(t.is_deleted)

    def test_tipo_sin_documentos_puede_eliminarse(self):
        t = TipoDocDigital.objects.create(descripcion='Tipo Sin Docs', storage_key='tipo_sin_docs')
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_doc_paciente_borrado_no_bloquea_si_prestador_tambien_borrado(self):
        t = TipoDocDigital.objects.create(descripcion='Tipo Ambos Borrados', storage_key='tipo_ambos_borr')
        self._crear_doc_paciente(t, is_deleted=True)
        self._crear_doc_prestador(t, is_deleted=True)
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class TipoDocDigAuditoriaTest(BaseTipoDocDig):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Audit Crear',
            'storage_key': 'audit_crear',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'TipoDocDigital')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'descripcion': 'Audit Editar'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'TipoDocDigital')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        t = TipoDocDigital.objects.create(descripcion='Audit Delete', storage_key='audit_delete')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/tipo-doc-dig/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'TipoDocDigital')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/tipo-doc-dig/', {
            'descripcion': 'Audit Usuario',
            'storage_key': 'audit_usuario',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_contienen_valores_correctos(self):
        r = self.client.patch(f'/api/tipo-doc-dig/{self.tipo.id}/', {'descripcion': 'Audit Snapshots'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
        self.assertIn('Historia Clínica', str(reg.datos_antes))
        self.assertIn('Audit Snapshots', str(reg.datos_despues))
