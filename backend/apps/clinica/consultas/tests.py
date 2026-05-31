from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.clinica.consultas.models import Consulta
from apps.clinica.agenda.models import Agenda
from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador
from apps.clinica.configuracion.consultorio.models import Consultorio
from apps.clinica.configuracion.eventoclinico.models import EventoClinico
from apps.clinica.paciente.models import Paciente
from apps.administracion.persona_rrhh.models import PersonaRRHH
from apps.administracion.persona.models import TipoDocumento, Persona
from apps.mantenimiento.diasemana.models import DiaSemana
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


class BaseConsulta(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('cs_admin',  'admin')
        self.recep  = crear_usuario('cs_recep',  'recepcionista')
        self.medico = crear_usuario('cs_medico', 'medico')

        self.tipo_doc    = TipoDocumento.objects.create(descripcion='CI Consulta Test')
        persona_pres     = crear_persona('CS_PRES01', 'Médico Test Consulta', self.tipo_doc)
        self.prestador   = PersonaRRHH.objects.create(persona=persona_pres, cargo='medico', tipo_contrato='dependencia')
        self.consultorio = Consultorio.objects.create(nro_consultorio='CS-C1')
        self.dia, _      = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})

        self.horario = HorarioPrestador.objects.create(
            persona_rrhh=self.prestador,
            consultorio=self.consultorio,
            dia_semana=self.dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )

        persona_pac   = crear_persona('CS_PAC01', 'Paciente Test Consulta', self.tipo_doc)
        self.paciente = Paciente.objects.create(persona=persona_pac, sexo='F')

        self.evento = EventoClinico.objects.create(tipo_evento='Control CS Test')

        self.agenda = Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=self.paciente,
            fecha='2026-07-07',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.OCUPADO,
        )

        self.consulta = Consulta.objects.create(
            agenda=self.agenda,
            estado=Consulta.Estado.EN_ESPERA,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def nueva_agenda(self, hora_desde='09:00', hora_hasta='09:30', fecha='2026-07-07'):
        return Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=self.paciente,
            fecha=fecha,
            hora_desde=hora_desde,
            hora_hasta=hora_hasta,
            estado=Agenda.Estado.OCUPADO,
        )


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class ConsultaPermisosTest(BaseConsulta):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/consultas/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/consultas/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/consultas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/consultas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/consultas/{self.consulta.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_crear(self):
        self.auth(self.medico)
        ag = self.nueva_agenda('09:30', '10:00')
        r = self.client.post('/api/consultas/', {'agenda': ag.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_medico_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'motivo_consulta': 'Dolor cabeza'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/consultas/{self.consulta.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/consultas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/consultas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        ag = self.nueva_agenda('10:00', '10:30')
        r = self.client.post('/api/consultas/', {'agenda': ag.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'motivo_consulta': 'Fiebre'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/consultas/{self.consulta.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/consultas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        ag = self.nueva_agenda('10:30', '11:00')
        c = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        r = self.client.delete(f'/api/consultas/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/consultas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class ConsultaCrudTest(BaseConsulta):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        ag  = self.nueva_agenda('09:00', '09:30')
        c2  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        c2.soft_delete()
        r = self.client.get('/api/consultas/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.consulta.id, ids)
        self.assertNotIn(c2.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/consultas/')
        item = next(x for x in r.data['results'] if x['id'] == self.consulta.id)
        for campo in ['id', 'agenda', 'agenda_detalle', 'estado', 'hora_desde', 'hora_hasta']:
            self.assertIn(campo, item)

    def test_list_filtro_por_fecha(self):
        ag2 = Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=self.paciente,
            fecha='2026-08-04',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.OCUPADO,
        )
        c2 = Consulta.objects.create(agenda=ag2, estado=Consulta.Estado.EN_ESPERA)
        r = self.client.get('/api/consultas/?fecha=2026-08-04')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(c2.id, ids)
        self.assertNotIn(self.consulta.id, ids)

    def test_list_filtro_por_estado(self):
        ag2 = self.nueva_agenda('09:00', '09:30')
        c2  = Consulta.objects.create(agenda=ag2, estado=Consulta.Estado.EN_CONSULTA)
        r = self.client.get('/api/consultas/?estado=en_consulta')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(c2.id, ids)
        self.assertNotIn(self.consulta.id, ids)

    def test_list_filtro_por_paciente(self):
        persona2  = crear_persona('CS_PAC02', 'Otro Paciente CS', self.tipo_doc)
        paciente2 = Paciente.objects.create(persona=persona2, sexo='M')
        ag2 = Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=paciente2,
            fecha='2026-07-14',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.OCUPADO,
        )
        c2 = Consulta.objects.create(agenda=ag2, estado=Consulta.Estado.EN_ESPERA)
        r = self.client.get(f'/api/consultas/?paciente={paciente2.id}')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(c2.id, ids)
        self.assertNotIn(self.consulta.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_consulta(self):
        r = self.client.get(f'/api/consultas/{self.consulta.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['estado'], 'en_espera')
        self.assertEqual(r.data['agenda'], self.agenda.id)

    def test_retrieve_eliminado_retorna_404(self):
        ag = self.nueva_agenda('09:00', '09:30')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        c.soft_delete()
        r = self.client.get(f'/api/consultas/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_retorna_404(self):
        r = self.client.get('/api/consultas/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido(self):
        ag = self.nueva_agenda('09:00', '09:30')
        r  = self.client.post('/api/consultas/', {'agenda': ag.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['estado'], 'en_espera')

    def test_create_con_evento_clinico(self):
        ag = self.nueva_agenda('09:30', '10:00')
        r  = self.client.post('/api/consultas/', {
            'agenda': ag.id,
            'evento_clinico': self.evento.id,
            'motivo_consulta': 'Chequeo anual',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['evento_clinico'], self.evento.id)

    def test_create_agenda_no_ocupada_retorna_400(self):
        ag = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-14',
            hora_desde='09:00',
            hora_hasta='09:30',
            estado=Agenda.Estado.DISPONIBLE,
        )
        r = self.client.post('/api/consultas/', {'agenda': ag.id})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_agenda_ya_tiene_consulta_retorna_400(self):
        # self.agenda ya tiene self.consulta activa
        r = self.client.post('/api/consultas/', {'agenda': self.agenda.id})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_estado_default_en_espera(self):
        ag = self.nueva_agenda('10:00', '10:30')
        r  = self.client.post('/api/consultas/', {'agenda': ag.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        c  = Consulta.objects.get(pk=r.data['id'])
        self.assertEqual(c.estado, Consulta.Estado.EN_ESPERA)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_motivo_consulta(self):
        r = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'motivo_consulta': 'Dolor de cabeza'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.consulta.refresh_from_db()
        self.assertEqual(self.consulta.motivo_consulta, 'Dolor de cabeza')

    def test_patch_diagnostico(self):
        r = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'diagnostico': 'Cefalea tensional'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.consulta.refresh_from_db()
        self.assertEqual(self.consulta.diagnostico, 'Cefalea tensional')

    def test_patch_evento_clinico(self):
        r = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'evento_clinico': self.evento.id})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.consulta.refresh_from_db()
        self.assertEqual(self.consulta.evento_clinico_id, self.evento.id)

    def test_patch_proxima_cita(self):
        r = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'proxima_cita': '2026-09-01'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.consulta.refresh_from_db()
        self.assertEqual(str(self.consulta.proxima_cita), '2026-09-01')

    def test_patch_consulta_finalizada_sin_jwt_retorna_400(self):
        # force_authenticate no setea JWT → rol=None → no es medico/admin → 400
        ag = self.nueva_agenda('11:00', '11:30')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.FINALIZADA)
        r  = self.client.patch(f'/api/consultas/{c.id}/', {'diagnostico': 'Nuevo diag'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_sin_documentos_marca_is_deleted(self):
        ag = self.nueva_agenda('11:30', '12:00')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        r  = self.client.delete(f'/api/consultas/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        c.refresh_from_db()
        self.assertTrue(c.is_deleted)
        self.assertIsNotNone(c.fecha_eliminacion)

    def test_destroy_eliminado_retorna_404(self):
        ag = self.nueva_agenda('09:00', '09:30', fecha='2026-07-21')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        c.soft_delete()
        r  = self.client.delete(f'/api/consultas/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_no_aparece_en_list(self):
        ag = self.nueva_agenda('09:00', '09:30', fecha='2026-07-28')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        self.client.delete(f'/api/consultas/{c.id}/')
        r  = self.client.get('/api/consultas/')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(c.id, ids)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        ag = self.nueva_agenda('09:00', '09:30', fecha='2026-08-04')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        c.soft_delete()
        r  = self.client.get('/api/consultas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(c.id, ids)
        self.assertNotIn(self.consulta.id, ids)

    def test_eliminados_paginado(self):
        r = self.client.get('/api/consultas/eliminados/')
        self.assertIn('results', r.data)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Documentos activos bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class ConsultaConstraintTest(BaseConsulta):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        from apps.clinica.configuracion.documentos.models import DocumentoDigPaciente
        from apps.mantenimiento.tipo_doc_dig.models import TipoDocDigital
        self.DocumentoDigPaciente = DocumentoDigPaciente
        self.tipo_doc_dig = TipoDocDigital.objects.create(
            descripcion='Receta CS Test',
            storage_key='receta_cs_test',
        )

    def _crear_documento(self, consulta):
        return self.DocumentoDigPaciente.objects.create(
            paciente=self.paciente,
            tipo_doc_dig=self.tipo_doc_dig,
            consulta=consulta,
            filename='receta.pdf',
        )

    def test_consulta_con_documento_activo_no_puede_eliminarse(self):
        self._crear_documento(self.consulta)
        r = self.client.delete(f'/api/consultas/{self.consulta.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.consulta.refresh_from_db()
        self.assertFalse(self.consulta.is_deleted)

    def test_error_menciona_documento(self):
        self._crear_documento(self.consulta)
        r = self.client.delete(f'/api/consultas/{self.consulta.id}/')
        self.assertIn('document', str(r.data).lower())

    def test_consulta_con_documento_borrado_puede_eliminarse(self):
        doc = self._crear_documento(self.consulta)
        doc.soft_delete()
        r = self.client.delete(f'/api/consultas/{self.consulta.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.consulta.refresh_from_db()
        self.assertTrue(self.consulta.is_deleted)

    def test_consulta_sin_documentos_puede_eliminarse(self):
        ag = self.nueva_agenda('09:00', '09:30')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        r  = self.client.delete(f'/api/consultas/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class ConsultaAuditoriaTest(BaseConsulta):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        ag    = self.nueva_agenda('09:00', '09:30')
        r     = self.client.post('/api/consultas/', {'agenda': ag.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Consulta')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r     = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'motivo_consulta': 'Audit'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Consulta')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        ag    = self.nueva_agenda('09:00', '09:30')
        c     = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)
        antes = RegistroAuditoria.objects.count()
        r     = self.client.delete(f'/api/consultas/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Consulta')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        ag = self.nueva_agenda('09:30', '10:00')
        r  = self.client.post('/api/consultas/', {'agenda': ag.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_no_nulos(self):
        r = self.client.patch(f'/api/consultas/{self.consulta.id}/', {'diagnostico': 'Snap diag'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)


# ══════════════════════════════════════════════════════════════════════════════
# ACCIONES PERSONALIZADAS
# ══════════════════════════════════════════════════════════════════════════════

class ConsultaAccionesTest(BaseConsulta):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def _consulta_en_espera(self, hora='09:00'):
        ag = self.nueva_agenda(hora, f'{int(hora[:2]):02d}:30')
        return Consulta.objects.create(agenda=ag, estado=Consulta.Estado.EN_ESPERA)

    def _consulta_en_curso(self, hora='09:00'):
        c = self._consulta_en_espera(hora)
        c.estado = Consulta.Estado.EN_CONSULTA
        c.save()
        return c

    # ── /iniciar/ ─────────────────────────────────────────────────────────────

    def test_iniciar_consulta_en_espera(self):
        c = self._consulta_en_espera('09:00')
        r = self.client.post(f'/api/consultas/{c.id}/iniciar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        c.refresh_from_db()
        self.assertEqual(c.estado, Consulta.Estado.EN_CONSULTA)
        self.assertIsNotNone(c.hora_desde)

    def test_iniciar_consulta_ya_iniciada_retorna_400(self):
        c = self._consulta_en_curso('09:30')
        r = self.client.post(f'/api/consultas/{c.id}/iniciar/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_iniciar_consulta_finalizada_retorna_400(self):
        ag = self.nueva_agenda('10:00', '10:30')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.FINALIZADA)
        r  = self.client.post(f'/api/consultas/{c.id}/iniciar/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /anular/ ──────────────────────────────────────────────────────────────

    def test_anular_consulta_en_curso(self):
        c = self._consulta_en_curso('10:00')
        r = self.client.post(f'/api/consultas/{c.id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        c.refresh_from_db()
        self.assertEqual(c.estado, Consulta.Estado.ANULADA)
        self.assertIsNotNone(c.hora_hasta)

    def test_anular_consulta_en_espera_retorna_400(self):
        c = self._consulta_en_espera('10:30')
        r = self.client.post(f'/api/consultas/{c.id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anular_consulta_finalizada_retorna_400(self):
        ag = self.nueva_agenda('11:00', '11:30')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.FINALIZADA)
        r  = self.client.post(f'/api/consultas/{c.id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /finalizar/ ───────────────────────────────────────────────────────────

    def test_finalizar_consulta_en_curso(self):
        c = self._consulta_en_curso('11:00')
        r = self.client.post(f'/api/consultas/{c.id}/finalizar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        c.refresh_from_db()
        self.assertEqual(c.estado, Consulta.Estado.FINALIZADA)
        self.assertIsNotNone(c.hora_hasta)

    def test_finalizar_marca_agenda_como_realizada(self):
        c  = self._consulta_en_curso('11:30')
        ag = c.agenda
        r  = self.client.post(f'/api/consultas/{c.id}/finalizar/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ag.refresh_from_db()
        self.assertEqual(ag.estado, Agenda.Estado.REALIZADO)

    def test_finalizar_consulta_en_espera_retorna_400(self):
        c = self._consulta_en_espera('09:00')
        r = self.client.post(f'/api/consultas/{c.id}/finalizar/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_finalizar_consulta_ya_finalizada_retorna_400(self):
        ag = self.nueva_agenda('09:00', '09:30', fecha='2026-08-11')
        c  = Consulta.objects.create(agenda=ag, estado=Consulta.Estado.FINALIZADA)
        r  = self.client.post(f'/api/consultas/{c.id}/finalizar/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /stats-hoy/ ───────────────────────────────────────────────────────────

    def test_stats_hoy_retorna_200(self):
        r = self.client.get('/api/consultas/stats-hoy/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_stats_hoy_estructura(self):
        r = self.client.get('/api/consultas/stats-hoy/')
        for campo in ['total', 'en_espera', 'en_consulta', 'finalizadas']:
            self.assertIn(campo, r.data)

    # ── dashboard-consultas ───────────────────────────────────────────────────

    def test_dashboard_consultas_retorna_200(self):
        r = self.client.get('/api/consultas/dashboard-consultas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_dashboard_consultas_estructura(self):
        r = self.client.get('/api/consultas/dashboard-consultas/')
        for campo in ['total_mes', 'por_estado', 'top_prestadores',
                      'por_especialidad', 'comparativa_6_meses']:
            self.assertIn(campo, r.data)
