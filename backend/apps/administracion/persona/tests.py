from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

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


# ══════════════════════════════════════════════════════════════════════════════
# TIPO DOCUMENTO
# ══════════════════════════════════════════════════════════════════════════════

class BaseTipoDocumento(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('per_td_admin',  'admin')
        self.recep  = crear_usuario('per_td_recep',  'recepcionista')
        self.medico = crear_usuario('per_td_medico', 'medico')
        self.tipo   = TipoDocumento.objects.create(descripcion='Cédula de Identidad')

    def auth(self, user):
        self.client.force_authenticate(user=user)


class TipoDocumentoPermisosTest(BaseTipoDocumento):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/tipo-documento/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/tipo-documento/', {'descripcion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/tipo-documento/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/tipo-documento/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/tipo-documento/', {'descripcion': 'Pasaporte'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/tipo-documento/{self.tipo.id}/', {'descripcion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/tipo-documento/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/tipo-documento/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/tipo-documento/', {'descripcion': 'Pasaporte'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/tipo-documento/{self.tipo.id}/', {'descripcion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/tipo-documento/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        r = self.client.post('/api/tipo-documento/', {'descripcion': 'Pasaporte'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_editar(self):
        self.auth(self.admin)
        r = self.client.patch(f'/api/tipo-documento/{self.tipo.id}/', {'descripcion': 'CI Edit'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        t = TipoDocumento.objects.create(descripcion='Para Eliminar TD')
        r = self.client.delete(f'/api/tipo-documento/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


class TipoDocumentoCrudTest(BaseTipoDocumento):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/tipo-documento/')
        item = next(t for t in r.data['results'] if t['id'] == self.tipo.id)
        self.assertIn('id', item)
        self.assertIn('descripcion', item)

    def test_retrieve_devuelve_tipo_documento(self):
        r = self.client.get(f'/api/tipo-documento/{self.tipo.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['descripcion'], 'Cédula de Identidad')

    def test_create_valido(self):
        r = self.client.post('/api/tipo-documento/', {'descripcion': 'RUC'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'RUC')

    def test_create_duplicado_retorna_400(self):
        r = self.client.post('/api/tipo-documento/', {'descripcion': 'Cédula de Identidad'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/tipo-documento/{self.tipo.id}/', {'descripcion': 'Cédula Actualizada'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_destroy_marca_is_deleted(self):
        t = TipoDocumento.objects.create(descripcion='Para Borrar TD')
        r = self.client.delete(f'/api/tipo-documento/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        t.refresh_from_db()
        self.assertTrue(t.is_deleted)

    def test_destroy_con_persona_vinculada_retorna_400(self):
        tipo_con_persona = TipoDocumento.objects.create(descripcion='Tipo Con Persona Vinculada')
        Persona.objects.create(
            tipo_documento=tipo_con_persona,
            nro_documento='CONSTR001',
            razon_social='Constraint Test',
        )
        r = self.client.delete(f'/api/tipo-documento/{tipo_con_persona.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        tipo_con_persona.refresh_from_db()
        self.assertFalse(tipo_con_persona.is_deleted)

    def test_destroy_con_persona_vinculada_error_menciona_personas(self):
        tipo_con_persona = TipoDocumento.objects.create(descripcion='Tipo Error Msg Personas')
        Persona.objects.create(
            tipo_documento=tipo_con_persona,
            nro_documento='CONSTR002',
            razon_social='Constraint Test 2',
        )
        r = self.client.delete(f'/api/tipo-documento/{tipo_con_persona.id}/')
        self.assertIn('persona', str(r.data).lower())


class TipoDocumentoAuditoriaTest(BaseTipoDocumento):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        self.client.post('/api/tipo-documento/', {'descripcion': 'Audit TD Crear'})
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'TipoDocumento')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        self.client.patch(f'/api/tipo-documento/{self.tipo.id}/', {'descripcion': 'Audit TD Editar'})
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'TipoDocumento')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        t = TipoDocumento.objects.create(descripcion='Audit TD Delete')
        antes = RegistroAuditoria.objects.count()
        self.client.delete(f'/api/tipo-documento/{t.id}/')
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'TipoDocumento')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)


# ══════════════════════════════════════════════════════════════════════════════
# PERSONA
# ══════════════════════════════════════════════════════════════════════════════

class BasePersona(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('per_admin',  'admin')
        self.recep  = crear_usuario('per_recep',  'recepcionista')
        self.medico = crear_usuario('per_medico', 'medico')
        self.tipo   = TipoDocumento.objects.create(descripcion='CI Test Persona')
        self.persona = Persona.objects.create(
            tipo_documento=self.tipo,
            nro_documento='1111111',
            razon_social='García López, Juan Carlos',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


class PersonaPermisosTest(BasePersona):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/persona/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/persona/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_buscar(self):
        r = self.client.get('/api/persona/buscar/?nro_documento=1111111')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/persona/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/persona/{self.persona.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_buscar(self):
        self.auth(self.medico)
        r = self.client.get('/api/persona/buscar/?nro_documento=1111111')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '9999991',
            'razon_social': 'Test Médico',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'razon_social': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/persona/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '9999992',
            'razon_social': 'Test Recep',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'razon_social': 'Editado Recep'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_destroy_siempre_retorna_405(self):
        self.auth(self.admin)
        r = self.client.delete(f'/api/persona/{self.persona.id}/')
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_recep_destroy_retorna_403(self):
        # La recepcionista no tiene permiso IsAdminRole → 403 antes de llegar a perform_destroy
        self.auth(self.recep)
        r = self.client.delete(f'/api/persona/{self.persona.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class PersonaCrudTest(BasePersona):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrada = Persona.objects.create(
            tipo_documento=self.tipo, nro_documento='BORRADA1', razon_social='Borrada'
        )
        borrada.soft_delete()
        r = self.client.get('/api/persona/')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.persona.id, ids)
        self.assertNotIn(borrada.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/persona/')
        item = next(p for p in r.data['results'] if p['id'] == self.persona.id)
        for campo in ['id', 'tipo_documento', 'tipo_documento_detalle', 'nro_documento', 'razon_social']:
            self.assertIn(campo, item)

    def test_list_busqueda_por_razon_social(self):
        r = self.client.get('/api/persona/?search=García')
        self.assertGreater(len(r.data['results']), 0)
        self.assertTrue(any(p['id'] == self.persona.id for p in r.data['results']))

    def test_list_busqueda_por_nro_documento(self):
        r = self.client.get('/api/persona/?search=1111111')
        self.assertGreater(len(r.data['results']), 0)
        self.assertTrue(any(p['id'] == self.persona.id for p in r.data['results']))

    def test_list_busqueda_por_correo(self):
        p = Persona.objects.create(
            tipo_documento=self.tipo,
            nro_documento='CORREO001',
            razon_social='Test Correo',
            correo_electronico='test.buscar@clinica.com',
        )
        r = self.client.get('/api/persona/?search=test.buscar@clinica.com')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(p.id, ids)

    def test_list_con_rol_true_excluye_sin_vinculacion(self):
        p_sin_rol = Persona.objects.create(
            tipo_documento=self.tipo,
            nro_documento='SINROL001',
            razon_social='Sin Rol',
        )
        r = self.client.get('/api/persona/?con_rol=true')
        ids = [item['id'] for item in r.data['results']]
        self.assertNotIn(p_sin_rol.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_persona(self):
        r = self.client.get(f'/api/persona/{self.persona.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['nro_documento'], '1111111')
        self.assertEqual(r.data['razon_social'], 'García López, Juan Carlos')

    def test_retrieve_inexistente_retorna_404(self):
        r = self.client.get('/api/persona/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimo_valido(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '2222222',
            'razon_social': 'Rodríguez, María',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_documento'], '2222222')

    def test_create_strip_razon_social(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '3333333',
            'razon_social': '  Espacio Alrededor  ',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['razon_social'], 'Espacio Alrededor')

    def test_create_con_todos_los_campos_opcionales(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '4444444',
            'razon_social': 'Completo, Test',
            'telefono': '0991 123456',
            'correo_electronico': 'completo@test.com',
            'direccion': 'Avda. España 1234',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_nro_documento_duplicado_retorna_400(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '1111111',
            'razon_social': 'Duplicado Test',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_nro_documento_duplicado_case_insensitive_retorna_400(self):
        Persona.objects.create(
            tipo_documento=self.tipo, nro_documento='ABCDEF', razon_social='Original'
        )
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': 'abcdef',
            'razon_social': 'Duplicado CI',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_nro_documento_retorna_400(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'razon_social': 'Sin Nro',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_razon_social_retorna_400(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '5555555',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_telefono_invalido_retorna_400(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '6666666',
            'razon_social': 'Telefono Invalido',
            'telefono': '123abc',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_email_invalido_retorna_400(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '7777777',
            'razon_social': 'Email Invalido',
            'correo_electronico': 'notanemail',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_telefono_vacio_es_opcional(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': '8888888',
            'razon_social': 'Sin Telefono',
            'telefono': '',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_nro_reutilizable_tras_borrado_logico(self):
        borrada = Persona.objects.create(
            tipo_documento=self.tipo, nro_documento='REUTILIZ', razon_social='Borrada'
        )
        borrada.soft_delete()
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': 'REUTILIZ',
            'razon_social': 'Reutilizada',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_razon_social(self):
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'razon_social': 'Nuevo Nombre'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.persona.refresh_from_db()
        self.assertEqual(self.persona.razon_social, 'Nuevo Nombre')

    def test_patch_mismo_nro_no_falla(self):
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'nro_documento': '1111111'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_nro_duplicado_de_otro_retorna_400(self):
        otra = Persona.objects.create(
            tipo_documento=self.tipo, nro_documento='OTRO001', razon_social='Otra Persona'
        )
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'nro_documento': 'OTRO001'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_telefono_valido(self):
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'telefono': '0991 123456'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_telefono_invalido_retorna_400(self):
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'telefono': 'INVALIDO'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_email_valido(self):
        r = self.client.patch(
            f'/api/persona/{self.persona.id}/',
            {'correo_electronico': 'nuevo@correo.com'}
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_email_invalido_retorna_400(self):
        r = self.client.patch(
            f'/api/persona/{self.persona.id}/',
            {'correo_electronico': 'noesuncorreo'}
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_retorna_405_method_not_allowed(self):
        r = self.client.delete(f'/api/persona/{self.persona.id}/')
        self.assertEqual(r.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_destroy_no_modifica_el_registro(self):
        self.client.delete(f'/api/persona/{self.persona.id}/')
        self.persona.refresh_from_db()
        self.assertFalse(self.persona.is_deleted)

    # ── Buscar ────────────────────────────────────────────────────────────────

    def test_buscar_persona_existente_devuelve_datos(self):
        r = self.client.get('/api/persona/buscar/?nro_documento=1111111')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(r.data['persona'])
        self.assertEqual(r.data['persona']['nro_documento'], '1111111')
        self.assertFalse(r.data['es_paciente'])

    def test_buscar_persona_existente_con_paciente(self):
        from apps.clinica.paciente.models import Paciente
        paciente = Paciente.objects.create(persona=self.persona)
        r = self.client.get('/api/persona/buscar/?nro_documento=1111111')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['es_paciente'])
        self.assertIsNotNone(r.data['paciente'])
        self.assertEqual(r.data['paciente']['id'], paciente.id)

    def test_buscar_persona_inexistente_devuelve_persona_none(self):
        r = self.client.get('/api/persona/buscar/?nro_documento=NOEXISTE999')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNone(r.data['persona'])
        self.assertFalse(r.data['es_paciente'])

    def test_buscar_sin_parametro_retorna_400(self):
        r = self.client.get('/api/persona/buscar/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_buscar_exacto_por_nro_documento(self):
        # La búsqueda en buscar es por coincidencia exacta, no substring
        Persona.objects.create(
            tipo_documento=self.tipo, nro_documento='11111112', razon_social='Similar'
        )
        r = self.client.get('/api/persona/buscar/?nro_documento=1111111')
        self.assertEqual(r.data['persona']['nro_documento'], '1111111')


class PersonaAuditoriaTest(BasePersona):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': 'AUDIT001',
            'razon_social': 'Audit Crear Persona',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Persona')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'razon_social': 'Audit Editar'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Persona')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_destroy_no_registra_auditoria(self):
        # perform_destroy lanza MethodNotAllowed → no hay registro de ELIMINAR
        antes = RegistroAuditoria.objects.count()
        self.client.delete(f'/api/persona/{self.persona.id}/')
        self.assertEqual(RegistroAuditoria.objects.count(), antes)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/persona/', {
            'tipo_documento': self.tipo.id,
            'nro_documento': 'AUDIT002',
            'razon_social': 'Audit Usuario',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_no_nulos(self):
        r = self.client.patch(f'/api/persona/{self.persona.id}/', {'razon_social': 'Audit Snapshots'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
        self.assertIn('García López, Juan Carlos', str(reg.datos_antes))
        self.assertIn('Audit Snapshots', str(reg.datos_despues))
