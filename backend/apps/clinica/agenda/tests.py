from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.clinica.agenda.models import Agenda
from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador
from apps.clinica.configuracion.consultorio.models import Consultorio
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


class BaseAgenda(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('ag_admin',  'admin')
        self.recep  = crear_usuario('ag_recep',  'recepcionista')
        self.medico = crear_usuario('ag_medico', 'medico')

        self.tipo_doc    = TipoDocumento.objects.create(descripcion='CI Agenda Test')
        persona_pres     = crear_persona('AG_PRES01', 'Médico Agenda Test', self.tipo_doc)
        self.prestador   = PersonaRRHH.objects.create(persona=persona_pres, cargo='medico', tipo_contrato='dependencia')
        self.consultorio = Consultorio.objects.create(nro_consultorio='AG-C1')
        self.dia, _      = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})

        self.horario = HorarioPrestador.objects.create(
            persona_rrhh=self.prestador,
            consultorio=self.consultorio,
            dia_semana=self.dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )

        persona_pac   = crear_persona('AG_PAC01', 'Paciente Agenda Test', self.tipo_doc)
        self.paciente = Paciente.objects.create(persona=persona_pac, sexo='M')

        self.turno = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-07',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.DISPONIBLE,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class AgendaPermisosTest(BaseAgenda):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/agenda/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/agenda/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/agenda/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/agenda/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-07-14',
            'hora_desde': '10:00',
            'hora_hasta': '10:30',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/agenda/{self.turno.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/agenda/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/agenda/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-07-14',
            'hora_desde': '10:00',
            'hora_hasta': '10:30',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/agenda/{self.turno.id}/', {'observacion': 'Obs test'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/agenda/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-21',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        r = self.client.delete(f'/api/agenda/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/agenda/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class AgendaCrudTest(BaseAgenda):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        t_borrado = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-14',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        t_borrado.soft_delete()
        r = self.client.get('/api/agenda/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.turno.id, ids)
        self.assertNotIn(t_borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/agenda/')
        item = next(x for x in r.data['results'] if x['id'] == self.turno.id)
        for campo in [
            'id', 'horario_prestador', 'horario_prestador_detalle',
            'paciente', 'paciente_detalle',
            'fecha', 'hora_desde', 'hora_hasta', 'estado',
        ]:
            self.assertIn(campo, item)

    def test_list_filtro_por_fecha(self):
        t2 = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-08-04',
            hora_desde='10:00',
            hora_hasta='10:30',
        )
        r = self.client.get('/api/agenda/?fecha=2026-08-04')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(t2.id, ids)
        self.assertNotIn(self.turno.id, ids)

    def test_list_filtro_por_estado(self):
        t_inact = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-08-11',
            hora_desde='11:00',
            hora_hasta='11:30',
            estado=Agenda.Estado.INACTIVO,
        )
        r = self.client.get('/api/agenda/?estado=inactivo')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(t_inact.id, ids)
        self.assertNotIn(self.turno.id, ids)

    def test_list_filtro_por_persona_rrhh(self):
        persona2  = crear_persona('AG_PRES02', 'Otro Médico', self.tipo_doc)
        prestador2 = PersonaRRHH.objects.create(persona=persona2, cargo='medico', tipo_contrato='eventual')
        dia2, _    = DiaSemana.objects.get_or_create(id=2, defaults={'descripcion': 'Martes'})
        horario2   = HorarioPrestador.objects.create(
            persona_rrhh=prestador2, dia_semana=dia2,
            hora_desde='09:00', hora_hasta='13:00', intervalo=30,
        )
        t2 = Agenda.objects.create(
            horario_prestador=horario2,
            fecha='2026-08-18',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        r = self.client.get(f'/api/agenda/?persona_rrhh={self.prestador.id}')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.turno.id, ids)
        self.assertNotIn(t2.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_turno(self):
        r = self.client.get(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['fecha'], '2026-07-07')
        self.assertEqual(r.data['estado'], 'disponible')

    def test_retrieve_eliminado_retorna_404(self):
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-08-25',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        t.soft_delete()
        r = self.client.get(f'/api/agenda/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_retorna_404(self):
        r = self.client.get('/api/agenda/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimo_valido(self):
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-09-07',
            'hora_desde': '10:00',
            'hora_hasta': '10:30',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['estado'], 'disponible')

    def test_create_con_paciente_y_observacion(self):
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'paciente': self.paciente.id,
            'fecha': '2026-09-14',
            'hora_desde': '10:00',
            'hora_hasta': '10:30',
            'estado': 'ocupado',
            'observacion': 'Primera consulta',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['paciente'], self.paciente.id)
        self.assertEqual(r.data['observacion'], 'Primera consulta')

    def test_create_sin_horario_prestador_retorna_400(self):
        r = self.client.post('/api/agenda/', {
            'fecha': '2026-09-21',
            'hora_desde': '10:00',
            'hora_hasta': '10:30',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_retorna_400(self):
        # self.turno ya tiene horario + fecha 2026-07-07 + hora_desde 08:00
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-07-07',
            'hora_desde': '08:00',
            'hora_hasta': '08:30',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_reutilizable_tras_borrado(self):
        self.turno.soft_delete()
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-07-07',
            'hora_desde': '08:00',
            'hora_hasta': '08:30',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_estado_default_disponible(self):
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-09-28',
            'hora_desde': '11:00',
            'hora_hasta': '11:30',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        t = Agenda.objects.get(pk=r.data['id'])
        self.assertEqual(t.estado, Agenda.Estado.DISPONIBLE)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_observacion(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/', {'observacion': 'Nueva obs'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.turno.refresh_from_db()
        self.assertEqual(self.turno.observacion, 'Nueva obs')

    def test_patch_estado(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.turno.refresh_from_db()
        self.assertEqual(self.turno.estado, 'inactivo')

    def test_patch_mismo_estado_no_falla(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/', {'estado': 'disponible'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_duplicado_de_otro_retorna_400(self):
        t2 = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-10-05',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        # El validador necesita los 3 campos del constraint para detectar el duplicado en PATCH
        r = self.client.patch(f'/api/agenda/{t2.id}/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-07-07',
            'hora_desde': '08:00',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_sin_consultas_marca_is_deleted(self):
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-10-12',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        r = self.client.delete(f'/api/agenda/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        t.refresh_from_db()
        self.assertTrue(t.is_deleted)
        self.assertIsNotNone(t.fecha_eliminacion)

    def test_destroy_eliminado_retorna_404(self):
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-10-19',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        t.soft_delete()
        r = self.client.delete(f'/api/agenda/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_no_aparece_en_list(self):
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-10-26',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        self.client.delete(f'/api/agenda/{t.id}/')
        r = self.client.get('/api/agenda/')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(t.id, ids)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-11-02',
            hora_desde='09:00',
            hora_hasta='09:30',
        )
        t.soft_delete()
        r = self.client.get('/api/agenda/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(t.id, ids)
        self.assertNotIn(self.turno.id, ids)

    def test_eliminados_paginado(self):
        r = self.client.get('/api/agenda/eliminados/')
        self.assertIn('results', r.data)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Consultas activas bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class AgendaConstraintTest(BaseAgenda):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        from apps.clinica.consultas.models import Consulta
        self.Consulta = Consulta

    def _crear_consulta(self, turno, estado):
        return self.Consulta.objects.create(
            agenda=turno,
            estado=estado,
        )

    def test_turno_con_consulta_activa_no_puede_eliminarse(self):
        self._crear_consulta(self.turno, self.Consulta.Estado.EN_ESPERA)
        r = self.client.delete(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.turno.refresh_from_db()
        self.assertFalse(self.turno.is_deleted)

    def test_turno_con_consulta_en_curso_no_puede_eliminarse(self):
        self._crear_consulta(self.turno, self.Consulta.Estado.EN_CONSULTA)
        r = self.client.delete(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_turno_con_consulta_finalizada_no_puede_eliminarse(self):
        self._crear_consulta(self.turno, self.Consulta.Estado.FINALIZADA)
        r = self.client.delete(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_error_menciona_consulta(self):
        self._crear_consulta(self.turno, self.Consulta.Estado.EN_ESPERA)
        r = self.client.delete(f'/api/agenda/{self.turno.id}/')
        self.assertIn('consult', str(r.data).lower())

    def test_turno_con_consulta_borrada_puede_eliminarse(self):
        c = self._crear_consulta(self.turno, self.Consulta.Estado.EN_ESPERA)
        c.soft_delete()
        r = self.client.delete(f'/api/agenda/{self.turno.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.turno.refresh_from_db()
        self.assertTrue(self.turno.is_deleted)

    def test_turno_sin_consultas_puede_eliminarse(self):
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-11-09',
            hora_desde='10:00',
            hora_hasta='10:30',
        )
        r = self.client.delete(f'/api/agenda/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class AgendaAuditoriaTest(BaseAgenda):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-11-16',
            'hora_desde': '10:00',
            'hora_hasta': '10:30',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Agenda')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/agenda/{self.turno.id}/', {'observacion': 'Audit obs'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Agenda')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        t = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-11-23',
            hora_desde='10:00',
            hora_hasta='10:30',
        )
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/agenda/{t.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Agenda')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/agenda/', {
            'horario_prestador': self.horario.id,
            'fecha': '2026-11-30',
            'hora_desde': '10:00',
            'hora_hasta': '10:30',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_no_nulos(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/', {'observacion': 'Snap obs'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)


# ══════════════════════════════════════════════════════════════════════════════
# ACCIONES PERSONALIZADAS
# ══════════════════════════════════════════════════════════════════════════════

class AgendaAccionesTest(BaseAgenda):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── /asignar/ ─────────────────────────────────────────────────────────────

    def test_asignar_turno_disponible(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/asignar/', {
            'paciente_id': self.paciente.id,
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.turno.refresh_from_db()
        self.assertEqual(self.turno.estado, Agenda.Estado.OCUPADO)
        self.assertEqual(self.turno.paciente_id, self.paciente.id)

    def test_asignar_guarda_observacion(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/asignar/', {
            'paciente_id': self.paciente.id,
            'observacion': 'Control de rutina',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.turno.refresh_from_db()
        self.assertEqual(self.turno.observacion, 'Control de rutina')

    def test_asignar_turno_no_disponible_retorna_400(self):
        self.turno.estado = Agenda.Estado.INACTIVO
        self.turno.save()
        r = self.client.patch(f'/api/agenda/{self.turno.id}/asignar/', {
            'paciente_id': self.paciente.id,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_asignar_sin_paciente_id_retorna_400(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/asignar/', {})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_asignar_paciente_inexistente_retorna_400(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/asignar/', {
            'paciente_id': 99999,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /estado/ ──────────────────────────────────────────────────────────────

    def test_cambiar_estado_a_inactivo(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/estado/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.turno.refresh_from_db()
        self.assertEqual(self.turno.estado, Agenda.Estado.INACTIVO)

    def test_cambiar_estado_a_cancelado_limpia_paciente(self):
        self.turno.paciente = self.paciente
        self.turno.estado = Agenda.Estado.OCUPADO
        self.turno.save()
        r = self.client.patch(f'/api/agenda/{self.turno.id}/estado/', {'estado': 'cancelado'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.turno.refresh_from_db()
        self.assertIsNone(self.turno.paciente)
        self.assertEqual(self.turno.estado, Agenda.Estado.CANCELADO)

    def test_cambiar_estado_a_realizado_desde_ocupado(self):
        self.turno.paciente = self.paciente
        self.turno.estado = Agenda.Estado.OCUPADO
        self.turno.save()
        r = self.client.patch(f'/api/agenda/{self.turno.id}/estado/', {'estado': 'realizado'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.turno.refresh_from_db()
        self.assertEqual(self.turno.estado, Agenda.Estado.REALIZADO)

    def test_cambiar_estado_a_realizado_sin_ser_ocupado_retorna_400(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/estado/', {'estado': 'realizado'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambiar_estado_ocupado_no_permitido_via_estado(self):
        # /estado/ no permite pasar a 'ocupado' — ese es solo vía /asignar/
        r = self.client.patch(f'/api/agenda/{self.turno.id}/estado/', {'estado': 'ocupado'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambiar_estado_invalido_retorna_400(self):
        r = self.client.patch(f'/api/agenda/{self.turno.id}/estado/', {'estado': 'invalido'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cambiar_estado_inactivo_desde_ocupado_retorna_400(self):
        self.turno.paciente = self.paciente
        self.turno.estado = Agenda.Estado.OCUPADO
        self.turno.save()
        r = self.client.patch(f'/api/agenda/{self.turno.id}/estado/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /reagendar/ ───────────────────────────────────────────────────────────

    def test_reagendar_turno_ocupado(self):
        self.turno.paciente = self.paciente
        self.turno.estado = Agenda.Estado.OCUPADO
        self.turno.observacion = 'Obs original'
        self.turno.save()

        nuevo = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-14',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.DISPONIBLE,
        )

        r = self.client.patch(f'/api/agenda/{self.turno.id}/reagendar/', {
            'nuevo_turno_id': nuevo.id,
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('turno_liberado', r.data)
        self.assertIn('turno_reagendado', r.data)

        self.turno.refresh_from_db()
        nuevo.refresh_from_db()
        self.assertEqual(self.turno.estado, Agenda.Estado.CANCELADO)
        self.assertIsNone(self.turno.paciente)
        self.assertEqual(nuevo.estado, Agenda.Estado.OCUPADO)
        self.assertEqual(nuevo.paciente_id, self.paciente.id)

    def test_reagendar_turno_no_ocupado_retorna_400(self):
        nuevo = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-14',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.DISPONIBLE,
        )
        r = self.client.patch(f'/api/agenda/{self.turno.id}/reagendar/', {
            'nuevo_turno_id': nuevo.id,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reagendar_sin_nuevo_turno_id_retorna_400(self):
        self.turno.estado = Agenda.Estado.OCUPADO
        self.turno.save()
        r = self.client.patch(f'/api/agenda/{self.turno.id}/reagendar/', {})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reagendar_nuevo_turno_no_disponible_retorna_400(self):
        self.turno.estado = Agenda.Estado.OCUPADO
        self.turno.save()
        nuevo = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-14',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.INACTIVO,
        )
        r = self.client.patch(f'/api/agenda/{self.turno.id}/reagendar/', {
            'nuevo_turno_id': nuevo.id,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reagendar_distinto_prestador_retorna_400(self):
        self.turno.estado = Agenda.Estado.OCUPADO
        self.turno.save()

        persona2   = crear_persona('AG_PRES03', 'Otro Pres', self.tipo_doc)
        prestador2 = PersonaRRHH.objects.create(persona=persona2, cargo='medico', tipo_contrato='eventual')
        dia2, _    = DiaSemana.objects.get_or_create(id=2, defaults={'descripcion': 'Martes'})
        horario2   = HorarioPrestador.objects.create(
            persona_rrhh=prestador2, dia_semana=dia2,
            hora_desde='09:00', hora_hasta='13:00', intervalo=30,
        )
        nuevo = Agenda.objects.create(
            horario_prestador=horario2,
            fecha='2026-07-14',
            hora_desde='09:00',
            hora_hasta='09:30',
            estado=Agenda.Estado.DISPONIBLE,
        )
        r = self.client.patch(f'/api/agenda/{self.turno.id}/reagendar/', {
            'nuevo_turno_id': nuevo.id,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /cancelar-rango/ ──────────────────────────────────────────────────────

    def test_cancelar_rango_cancela_disponibles(self):
        t1 = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-20',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.DISPONIBLE,
        )
        t2 = Agenda.objects.create(
            horario_prestador=self.horario,
            fecha='2026-07-21',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.DISPONIBLE,
        )
        r = self.client.post('/api/agenda/cancelar-rango/', {
            'persona_rrhh': self.prestador.id,
            'fecha_desde': '2026-07-20',
            'fecha_hasta': '2026-07-21',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['cancelados'], 2)
        t1.refresh_from_db()
        t2.refresh_from_db()
        self.assertEqual(t1.estado, Agenda.Estado.CANCELADO)
        self.assertEqual(t2.estado, Agenda.Estado.CANCELADO)

    def test_cancelar_rango_informa_ocupados_no_cancelados(self):
        Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=self.paciente,
            fecha='2026-07-28',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=Agenda.Estado.OCUPADO,
        )
        r = self.client.post('/api/agenda/cancelar-rango/', {
            'persona_rrhh': self.prestador.id,
            'fecha_desde': '2026-07-28',
            'fecha_hasta': '2026-07-28',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['cancelados'], 0)
        self.assertEqual(len(r.data['no_cancelados']), 1)

    def test_cancelar_rango_sin_params_retorna_400(self):
        r = self.client.post('/api/agenda/cancelar-rango/', {})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /resumen-mes/ ─────────────────────────────────────────────────────────

    def test_resumen_mes_retorna_200(self):
        r = self.client.get(
            f'/api/agenda/resumen-mes/?persona_rrhh={self.prestador.id}&mes=7&anio=2026'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)

    def test_resumen_mes_estructura_por_fecha(self):
        r = self.client.get(
            f'/api/agenda/resumen-mes/?persona_rrhh={self.prestador.id}&mes=7&anio=2026'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        if r.data:
            fila = r.data[0]
            for campo in ['fecha', 'disponibles', 'ocupados', 'total']:
                self.assertIn(campo, fila)

    def test_resumen_mes_sin_params_retorna_400(self):
        r = self.client.get('/api/agenda/resumen-mes/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── /stats-hoy/ ───────────────────────────────────────────────────────────

    def test_stats_hoy_retorna_200(self):
        r = self.client.get('/api/agenda/stats-hoy/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_stats_hoy_estructura(self):
        r = self.client.get('/api/agenda/stats-hoy/')
        for campo in ['total', 'confirmadas', 'pendientes', 'realizadas', 'inactivos', 'cancelados']:
            self.assertIn(campo, r.data)

    # ── dashboards ────────────────────────────────────────────────────────────

    def test_dashboard_agenda_retorna_200(self):
        r = self.client.get('/api/agenda/dashboard-agenda/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_dashboard_agenda_estructura(self):
        r = self.client.get('/api/agenda/dashboard-agenda/')
        for campo in ['total_mes', 'por_estado', 'top_prestadores', 'comparativa_6_meses']:
            self.assertIn(campo, r.data)

    def test_dashboard_prestadores_retorna_200(self):
        r = self.client.get('/api/agenda/dashboard-prestadores/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_dashboard_prestadores_estructura(self):
        r = self.client.get('/api/agenda/dashboard-prestadores/')
        for campo in ['turnos_por_medico', 'comparativa_especialidades',
                      'dias_mas_demandados', 'horarios_mas_demandados', 'ocupacion_promedio']:
            self.assertIn(campo, r.data)

    def test_dashboard_ocupacion_retorna_200(self):
        r = self.client.get('/api/agenda/dashboard-ocupacion/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_dashboard_ocupacion_estructura(self):
        r = self.client.get('/api/agenda/dashboard-ocupacion/')
        for campo in ['mapa_calor', 'consultorios', 'picos_por_mes']:
            self.assertIn(campo, r.data)
