from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.clinica.configuracion.eventoclinico.models import EventoClinico
from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


class BaseEventoClinico(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('ec_admin',  'admin')
        self.recep  = crear_usuario('ec_recep',  'recepcionista')
        self.medico = crear_usuario('ec_medico', 'medico')
        self.evento = EventoClinico.objects.create(tipo_evento='Consulta General')

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosTest(BaseEventoClinico):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/eventoclinico/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'X'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/eventoclinico/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/eventoclinico/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/eventoclinico/{self.evento.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'Cirugía'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/eventoclinico/{self.evento.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/eventoclinico/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/eventoclinico/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'Urgencia'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'Consulta General Edit'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/eventoclinico/{self.evento.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/eventoclinico/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        ev = EventoClinico.objects.create(tipo_evento='Para Eliminar')
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/eventoclinico/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class EventoClinicoCrudTest(BaseEventoClinico):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrado = EventoClinico.objects.create(tipo_evento='Borrado')
        borrado.soft_delete()
        r = self.client.get('/api/eventoclinico/')
        ids = [e['id'] for e in r.data['results']]
        self.assertIn(self.evento.id, ids)
        self.assertNotIn(borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/eventoclinico/')
        item = next(e for e in r.data['results'] if e['id'] == self.evento.id)
        self.assertIn('id', item)
        self.assertIn('tipo_evento', item)

    def test_list_busqueda_por_tipo_evento(self):
        EventoClinico.objects.create(tipo_evento='Internación')
        r = self.client.get('/api/eventoclinico/?search=nternaci')
        self.assertGreater(len(r.data['results']), 0)
        for e in r.data['results']:
            self.assertIn('nternaci', e['tipo_evento'].lower())

    def test_list_ordenado_por_tipo_evento_ascendente(self):
        EventoClinico.objects.create(tipo_evento='Atención de emergencia')
        r = self.client.get('/api/eventoclinico/')
        tipos = [e['tipo_evento'] for e in r.data['results']]
        self.assertEqual(tipos, sorted(tipos, key=lambda t: t.lower()))

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_evento(self):
        r = self.client.get(f'/api/eventoclinico/{self.evento.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['tipo_evento'], 'Consulta General')

    def test_retrieve_eliminado_devuelve_404(self):
        borrado = EventoClinico.objects.create(tipo_evento='Fantasma')
        borrado.soft_delete()
        r = self.client.get(f'/api/eventoclinico/{borrado.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/eventoclinico/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'Cirugía'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['tipo_evento'], 'Cirugía')

    def test_create_strip_espacios(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': '  Pediatría  '})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['tipo_evento'], 'Pediatría')

    def test_create_duplicado_exacto_retorna_400(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'Consulta General'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_case_insensitive_retorna_400(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'consulta general'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_mayusculas_retorna_400(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'CONSULTA GENERAL'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_tipo_evento_vacio_retorna_400(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': ''})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_tipo_evento_retorna_400(self):
        r = self.client.post('/api/eventoclinico/', {})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_reutiliza_nombre_tras_borrado_logico(self):
        borrado = EventoClinico.objects.create(tipo_evento='Reutilizable')
        borrado.soft_delete()
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'Reutilizable'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_reutiliza_nombre_case_insensitive_tras_borrado(self):
        borrado = EventoClinico.objects.create(tipo_evento='Ecografía')
        borrado.soft_delete()
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'ECOGRAFÍA'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_tipo_evento(self):
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'Consulta Pediátrica'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.evento.refresh_from_db()
        self.assertEqual(self.evento.tipo_evento, 'Consulta Pediátrica')

    def test_patch_mismo_nombre_no_falla(self):
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'Consulta General'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_mismo_nombre_case_insensitive_no_falla(self):
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'CONSULTA GENERAL'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_strip_espacios(self):
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': '  Consulta Adultos  '})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.evento.refresh_from_db()
        self.assertEqual(self.evento.tipo_evento, 'Consulta Adultos')

    def test_patch_duplicado_de_otro_retorna_400(self):
        EventoClinico.objects.create(tipo_evento='Cirugía Programada')
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'Cirugía Programada'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted_y_fecha(self):
        ev = EventoClinico.objects.create(tipo_evento='Para Borrar')
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        ev.refresh_from_db()
        self.assertTrue(ev.is_deleted)
        self.assertIsNotNone(ev.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        ev = EventoClinico.objects.create(tipo_evento='Para Borrar 2')
        self.client.delete(f'/api/eventoclinico/{ev.id}/')
        r = self.client.get('/api/eventoclinico/')
        ids = [e['id'] for e in r.data['results']]
        self.assertNotIn(ev.id, ids)

    def test_destroy_eliminado_retorna_404(self):
        ev = EventoClinico.objects.create(tipo_evento='Ya Borrado')
        ev.soft_delete()
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        ev = EventoClinico.objects.create(tipo_evento='Para Eliminados')
        ev.soft_delete()
        r = self.client.get('/api/eventoclinico/eliminados/')
        ids = [e['id'] for e in r.data]
        self.assertIn(ev.id, ids)
        self.assertNotIn(self.evento.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/eventoclinico/eliminados/')
        self.assertIsInstance(r.data, list)

    def test_eliminados_ordenados_por_tipo_evento(self):
        a = EventoClinico.objects.create(tipo_evento='Zzz Borrado')
        b = EventoClinico.objects.create(tipo_evento='Aaa Borrado')
        a.soft_delete()
        b.soft_delete()
        r = self.client.get('/api/eventoclinico/eliminados/')
        tipos = [e['tipo_evento'] for e in r.data if e['tipo_evento'] in ('Zzz Borrado', 'Aaa Borrado')]
        self.assertEqual(tipos, sorted(tipos, key=lambda t: t.lower()))


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Consultas activas bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class EventoClinicoConstraintTest(BaseEventoClinico):
    """
    Verifica que un evento clínico con consultas activas vinculadas no puede
    eliminarse, y que un evento sin consultas activas sí puede.
    """

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

        from apps.administracion.persona.models import TipoDocumento, Persona
        from apps.administracion.persona_rrhh.models import PersonaRRHH
        from apps.clinica.configuracion.consultorio.models import Consultorio
        from apps.mantenimiento.diasemana.models import DiaSemana
        from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador
        from apps.clinica.agenda.models import Agenda
        from apps.clinica.consultas.models import Consulta

        self.Consulta = Consulta

        tipo_doc    = TipoDocumento.objects.create(descripcion='CI')
        persona     = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='55500001',
            razon_social='Prestador Test EventoClinico',
        )
        rrhh        = PersonaRRHH.objects.create(persona=persona)
        consultorio = Consultorio.objects.create(nro_consultorio='EC-C1')
        dia, _      = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})
        horario     = HorarioPrestador.objects.create(
            persona_rrhh=rrhh,
            consultorio=consultorio,
            dia_semana=dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )
        self.agenda = Agenda.objects.create(
            horario_prestador=horario,
            fecha='2026-06-01',
            hora_desde='08:00',
            hora_hasta='08:30',
        )

    def _crear_consulta(self, evento, is_deleted=False):
        c = self.Consulta.objects.create(agenda=self.agenda, evento_clinico=evento)
        if is_deleted:
            c.soft_delete()
        return c

    def test_evento_con_consulta_activa_no_puede_eliminarse(self):
        ev = EventoClinico.objects.create(tipo_evento='Ev Con Consulta')
        self._crear_consulta(ev)
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        ev.refresh_from_db()
        self.assertFalse(ev.is_deleted)

    def test_error_menciona_consultas(self):
        ev = EventoClinico.objects.create(tipo_evento='Ev Error Msg')
        self._crear_consulta(ev)
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertIn('consulta', str(r.data).lower())

    def test_evento_con_solo_consulta_borrada_puede_eliminarse(self):
        ev = EventoClinico.objects.create(tipo_evento='Ev Consulta Borrada')
        self._crear_consulta(ev, is_deleted=True)
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        ev.refresh_from_db()
        self.assertTrue(ev.is_deleted)

    def test_evento_sin_consultas_puede_eliminarse(self):
        ev = EventoClinico.objects.create(tipo_evento='Ev Sin Consultas')
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class EventoClinicoAuditoriaTest(BaseEventoClinico):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'Audit Crear'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'EventoClinico')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'Audit Editar'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'EventoClinico')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        ev = EventoClinico.objects.create(tipo_evento='Audit Delete')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/eventoclinico/{ev.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'EventoClinico')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/eventoclinico/', {'tipo_evento': 'Audit Usuario'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_contienen_valores_correctos(self):
        r = self.client.patch(f'/api/eventoclinico/{self.evento.id}/', {'tipo_evento': 'Audit Snapshots'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
        self.assertIn('Consulta General', str(reg.datos_antes))
        self.assertIn('Audit Snapshots', str(reg.datos_despues))
