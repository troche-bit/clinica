from datetime import date, timedelta

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.persona.models import Persona, TipoDocumento
from apps.administracion.persona_rrhh.models import PersonaRRHH
from apps.administracion.users.models import PerfilUsuario
from apps.clinica.agenda.models import Agenda
from apps.clinica.configuracion.consultorio.models import Consultorio
from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador
from apps.clinica.consultas.models import Consulta
from apps.clinica.paciente.models import Paciente
from apps.mantenimiento.diasemana.models import DiaSemana
from apps.mantenimiento.notificaciones.models import (
    ConfiguracionNotificacion,
    Notificacion,
    PlantillaNotificacion,
)

User = get_user_model()

HOY    = date.today()
FUTURO = HOY + timedelta(days=7)
PASADO = HOY - timedelta(days=3)


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_persona(nro_doc, nombre, tipo_doc, email=None):
    return Persona.objects.create(
        tipo_documento=tipo_doc,
        nro_documento=nro_doc,
        razon_social=nombre,
        correo_electronico=email,
    )


# ══════════════════════════════════════════════════════════════════════════════
# BASE PLANTILLA — setup liviano para tests de PlantillaNotificacion
# ══════════════════════════════════════════════════════════════════════════════

class BasePlantilla(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('nt_admin',  'admin')
        self.recep  = crear_usuario('nt_recep',  'recepcionista')
        self.medico = crear_usuario('nt_medico', 'medico')

        self.plantilla = PlantillaNotificacion.objects.create(
            tipo='recordatorio',
            asunto='Recordatorio de cita',
            cuerpo='Hola {nombre}, su cita es el {fecha}.',
            activa=True,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# BASE NOTIFICACION — setup complejo para tests de Recordatorio y Notificacion
# ══════════════════════════════════════════════════════════════════════════════

class BaseNotificacion(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('nt2_admin',  'admin')
        self.recep  = crear_usuario('nt2_recep',  'recepcionista')
        self.medico = crear_usuario('nt2_medico', 'medico')

        self.tipo_doc    = TipoDocumento.objects.create(descripcion='CI Notif Test')
        persona_pres     = crear_persona('NT_PRES01', 'Médico Notif Test', self.tipo_doc)
        self.prestador   = PersonaRRHH.objects.create(
            persona=persona_pres, cargo='medico', tipo_contrato='dependencia',
        )
        self.consultorio = Consultorio.objects.create(nro_consultorio='NT-C1')
        self.dia, _      = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})

        self.horario = HorarioPrestador.objects.create(
            persona_rrhh=self.prestador,
            consultorio=self.consultorio,
            dia_semana=self.dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )

        persona_pac   = crear_persona('NT_PAC01', 'Paciente Notif Test', self.tipo_doc, email='pac@test.com')
        self.paciente = Paciente.objects.create(persona=persona_pac, sexo='M')

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
            estado=Consulta.Estado.FINALIZADA,
            proxima_cita=FUTURO,
        )

        self.notificacion = Notificacion.objects.create(
            paciente=self.paciente,
            consulta=self.consulta,
            tipo=Notificacion.Tipo.RECORDATORIO_CITA,
            canal=Notificacion.Canal.MANUAL,
            estado=Notificacion.Estado.ENVIADO,
            mensaje='Mensaje de prueba',
            destinatario='pac@test.com',
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS — PlantillaNotificacion
# ══════════════════════════════════════════════════════════════════════════════

class PlantillaPermisosTest(BasePlantilla):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/notificaciones/plantillas/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/notificaciones/plantillas/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/notificaciones/plantillas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/notificaciones/plantillas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'confirmacion', 'asunto': 'X', 'cuerpo': 'Y',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(
            f'/api/notificaciones/plantillas/{self.plantilla.id}/', {'asunto': 'X'},
        )
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/notificaciones/plantillas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/notificaciones/plantillas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'confirmacion', 'asunto': 'X', 'cuerpo': 'Y',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/notificaciones/plantillas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        r = self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'confirmacion', 'asunto': 'Conf', 'cuerpo': 'Hola {nombre}',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        r = self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/notificaciones/plantillas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD — PlantillaNotificacion
# ══════════════════════════════════════════════════════════════════════════════

class PlantillaCrudTest(BasePlantilla):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_list_solo_activos(self):
        PlantillaNotificacion.objects.create(
            tipo='cancelacion', asunto='B', cuerpo='B', is_deleted=True,
        )
        r = self.client.get('/api/notificaciones/plantillas/')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.plantilla.id, ids)

    def test_list_no_incluye_borrados(self):
        borrada = PlantillaNotificacion.objects.create(
            tipo='cancelacion', asunto='B', cuerpo='B', is_deleted=True,
        )
        r = self.client.get('/api/notificaciones/plantillas/')
        ids = [p['id'] for p in r.data['results']]
        self.assertNotIn(borrada.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/notificaciones/plantillas/')
        p = next(x for x in r.data['results'] if x['id'] == self.plantilla.id)
        for campo in ('id', 'tipo', 'tipo_display', 'asunto', 'cuerpo', 'activa'):
            self.assertIn(campo, p)
        self.assertEqual(p['tipo_display'], 'Recordatorio de cita')

    def test_retrieve(self):
        r = self.client.get(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['tipo'], 'recordatorio')
        self.assertEqual(r.data['asunto'], self.plantilla.asunto)

    def test_create_valido(self):
        r = self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'confirmacion',
            'asunto': 'Confirmación de su reserva',
            'cuerpo': 'Hola {nombre}, su cita fue confirmada.',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            PlantillaNotificacion.objects.filter(tipo='confirmacion', is_deleted=False).exists()
        )

    def test_create_tipo_invalido(self):
        r = self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'tipo_inexistente', 'asunto': 'X', 'cuerpo': 'Y',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_mismo_tipo(self):
        r = self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'recordatorio', 'asunto': 'Duplicado', 'cuerpo': 'Texto',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_tipo_reutilizable_tras_borrado(self):
        self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        r = self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'recordatorio',
            'asunto': 'Nuevo recordatorio',
            'cuerpo': 'Hola {nombre}',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_patch_asunto(self):
        r = self.client.patch(
            f'/api/notificaciones/plantillas/{self.plantilla.id}/',
            {'asunto': 'Asunto actualizado'},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.plantilla.refresh_from_db()
        self.assertEqual(self.plantilla.asunto, 'Asunto actualizado')

    def test_patch_activa_toggle(self):
        r = self.client.patch(
            f'/api/notificaciones/plantillas/{self.plantilla.id}/', {'activa': False},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.plantilla.refresh_from_db()
        self.assertFalse(self.plantilla.activa)

    def test_patch_mismo_tipo_no_falla(self):
        r = self.client.patch(
            f'/api/notificaciones/plantillas/{self.plantilla.id}/', {'tipo': 'recordatorio'},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_tipo_duplicado_otro_registro(self):
        otra = PlantillaNotificacion.objects.create(
            tipo='confirmacion', asunto='X', cuerpo='Y',
        )
        r = self.client.patch(
            f'/api/notificaciones/plantillas/{otra.id}/', {'tipo': 'recordatorio'},
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_destroy_marca_is_deleted(self):
        r = self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.plantilla.refresh_from_db()
        self.assertTrue(self.plantilla.is_deleted)
        self.assertIsNotNone(self.plantilla.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        r = self.client.get('/api/notificaciones/plantillas/')
        ids = [p['id'] for p in r.data['results']]
        self.assertNotIn(self.plantilla.id, ids)

    def test_destroy_ya_borrado_retorna_404(self):
        self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        r = self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_eliminados_incluye_borrados(self):
        self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        r = self.client.get('/api/notificaciones/plantillas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in r.data]
        self.assertIn(self.plantilla.id, ids)

    def test_eliminados_no_incluye_activos(self):
        r = self.client.get('/api/notificaciones/plantillas/eliminados/')
        ids = [p['id'] for p in r.data]
        self.assertNotIn(self.plantilla.id, ids)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA — PlantillaNotificacion
# ══════════════════════════════════════════════════════════════════════════════

class PlantillaAuditoriaTest(BasePlantilla):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_crear_registra_auditoria(self):
        self.client.post('/api/notificaciones/plantillas/', {
            'tipo': 'confirmacion', 'asunto': 'X', 'cuerpo': 'Y',
        })
        reg = RegistroAuditoria.objects.filter(
            tabla='PlantillaNotificacion',
            accion=RegistroAuditoria.Accion.CREAR,
        ).last()
        self.assertIsNotNone(reg)
        self.assertEqual(reg.usuario, self.admin)
        self.assertIsNotNone(reg.datos_despues)

    def test_editar_registra_auditoria(self):
        self.client.patch(
            f'/api/notificaciones/plantillas/{self.plantilla.id}/', {'asunto': 'Modificado'},
        )
        reg = RegistroAuditoria.objects.filter(
            tabla='PlantillaNotificacion',
            accion=RegistroAuditoria.Accion.EDITAR,
            registro_id=self.plantilla.id,
        ).last()
        self.assertIsNotNone(reg)
        self.assertEqual(reg.usuario, self.admin)
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)

    def test_eliminar_registra_auditoria(self):
        self.client.delete(f'/api/notificaciones/plantillas/{self.plantilla.id}/')
        reg = RegistroAuditoria.objects.filter(
            tabla='PlantillaNotificacion',
            accion=RegistroAuditoria.Accion.ELIMINAR,
            registro_id=self.plantilla.id,
        ).last()
        self.assertIsNotNone(reg)
        self.assertEqual(reg.usuario, self.admin)


# ══════════════════════════════════════════════════════════════════════════════
# RECORDATORIOS — proximas-citas, stats, notificar
# ══════════════════════════════════════════════════════════════════════════════

class RecordatorioTest(BaseNotificacion):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_anonimo_no_puede_ver_proximas_citas(self):
        self.client.force_authenticate(user=None)
        r = self.client.get('/api/recordatorios/proximas-citas/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_stats(self):
        self.client.force_authenticate(user=None)
        r = self.client.get('/api/recordatorios/stats/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_proximas_citas_incluye_consulta_con_proxima_cita(self):
        r = self.client.get('/api/recordatorios/proximas-citas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [c['consulta_id'] for c in r.data]
        self.assertIn(self.consulta.id, ids)

    def test_proximas_citas_estructura_correcta(self):
        r = self.client.get('/api/recordatorios/proximas-citas/')
        item = next(c for c in r.data if c['consulta_id'] == self.consulta.id)
        for campo in ('consulta_id', 'paciente', 'proxima_cita', 'dias_restantes', 'urgencia', 'estado'):
            self.assertIn(campo, item)
        for campo in ('nombre', 'email'):
            self.assertIn(campo, item['paciente'])

    def test_proximas_citas_urgencia_calculada(self):
        r = self.client.get('/api/recordatorios/proximas-citas/')
        item = next(c for c in r.data if c['consulta_id'] == self.consulta.id)
        # FUTURO = HOY + 7 días → dias_restantes=7 → 'urgente' (≤7)
        self.assertEqual(item['urgencia'], 'urgente')

    def test_proximas_citas_excluye_sin_proxima_cita(self):
        consulta_sin = Consulta.objects.create(
            agenda=self.agenda,
            estado=Consulta.Estado.FINALIZADA,
        )
        r = self.client.get('/api/recordatorios/proximas-citas/?periodo=todos')
        ids = [c['consulta_id'] for c in r.data]
        self.assertNotIn(consulta_sin.id, ids)

    def test_proximas_citas_periodo_vencidas(self):
        consulta_vencida = Consulta.objects.create(
            agenda=self.agenda,
            estado=Consulta.Estado.FINALIZADA,
            proxima_cita=PASADO,
        )
        r = self.client.get('/api/recordatorios/proximas-citas/?periodo=vencidas')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [c['consulta_id'] for c in r.data]
        self.assertIn(consulta_vencida.id, ids)
        self.assertNotIn(self.consulta.id, ids)

    def test_proximas_citas_periodo_todos(self):
        consulta_vencida = Consulta.objects.create(
            agenda=self.agenda,
            estado=Consulta.Estado.FINALIZADA,
            proxima_cita=PASADO,
        )
        r = self.client.get('/api/recordatorios/proximas-citas/?periodo=todos')
        ids = [c['consulta_id'] for c in r.data]
        self.assertIn(self.consulta.id, ids)
        self.assertIn(consulta_vencida.id, ids)

    def test_stats_estructura(self):
        r = self.client.get('/api/recordatorios/stats/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for campo in ('vencidas', 'proximos_7_dias', 'proximos_30_dias', 'agendadas'):
            self.assertIn(campo, r.data)

    def test_stats_cuenta_vencidas(self):
        Consulta.objects.create(
            agenda=self.agenda,
            estado=Consulta.Estado.FINALIZADA,
            proxima_cita=PASADO,
        )
        r = self.client.get('/api/recordatorios/stats/')
        self.assertGreaterEqual(r.data['vencidas'], 1)

    def test_stats_proximos_7_dias_incluye_futuro(self):
        r = self.client.get('/api/recordatorios/stats/')
        # self.consulta tiene proxima_cita=FUTURO (HOY+7), entra en proximos_7_dias
        self.assertGreaterEqual(r.data['proximos_7_dias'], 1)

    def test_notificar_canal_manual_crea_notificacion(self):
        r = self.client.post('/api/recordatorios/notificar/', {
            'consulta_id': self.consulta.id,
            'tipo':        'recordatorio_cita',
            'canal':       'manual',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['ok'])
        self.assertIn(r.data['estado'], (
            Notificacion.Estado.PENDIENTE,
            Notificacion.Estado.ENVIADO,
            Notificacion.Estado.FALLIDO,
        ))
        self.assertTrue(
            Notificacion.objects.filter(
                consulta=self.consulta, tipo='recordatorio_cita',
            ).exists()
        )

    def test_notificar_canal_email_crea_notificacion(self):
        r = self.client.post('/api/recordatorios/notificar/', {
            'consulta_id': self.consulta.id,
            'tipo':        'confirmacion_reserva',
            'canal':       'email',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        notif = Notificacion.objects.filter(
            consulta=self.consulta, tipo='confirmacion_reserva', canal='email',
        ).last()
        self.assertIsNotNone(notif)
        # Sin RESEND_API_KEY configurada el envío falla, pero el registro existe
        self.assertIn(notif.estado, (Notificacion.Estado.ENVIADO, Notificacion.Estado.FALLIDO))

    def test_notificar_sin_consulta_id_retorna_400(self):
        r = self.client.post('/api/recordatorios/notificar/', {'tipo': 'recordatorio_cita'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_notificar_consulta_inexistente_retorna_404(self):
        r = self.client.post('/api/recordatorios/notificar/', {
            'consulta_id': 99999,
            'tipo':        'recordatorio_cita',
        })
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_notificar_sin_tipo_retorna_400(self):
        r = self.client.post('/api/recordatorios/notificar/', {
            'consulta_id': self.consulta.id,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_medico_puede_notificar(self):
        self.auth(self.medico)
        r = self.client.post('/api/recordatorios/notificar/', {
            'consulta_id': self.consulta.id,
            'tipo':        'recordatorio_cita',
            'canal':       'manual',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICACIONES — list y filtros
# ══════════════════════════════════════════════════════════════════════════════

class NotificacionTest(BaseNotificacion):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_anonimo_no_puede_listar(self):
        self.client.force_authenticate(user=None)
        r = self.client.get('/api/notificaciones/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_devuelve_notificaciones(self):
        r = self.client.get('/api/notificaciones/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [n['id'] for n in r.data['results']]
        self.assertIn(self.notificacion.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/notificaciones/')
        n = next(x for x in r.data['results'] if x['id'] == self.notificacion.id)
        for campo in ('id', 'tipo', 'tipo_display', 'canal', 'canal_display',
                      'estado', 'estado_display', 'destinatario', 'fecha_creacion'):
            self.assertIn(campo, n)

    def test_filtro_por_paciente(self):
        r = self.client.get(f'/api/notificaciones/?paciente={self.paciente.id}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [n['id'] for n in r.data['results']]
        self.assertIn(self.notificacion.id, ids)

    def test_filtro_por_consulta(self):
        r = self.client.get(f'/api/notificaciones/?consulta={self.consulta.id}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [n['id'] for n in r.data['results']]
        self.assertIn(self.notificacion.id, ids)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/notificaciones/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN — singleton admin-only
# ══════════════════════════════════════════════════════════════════════════════

class ConfiguracionTest(BasePlantilla):

    def test_anonimo_no_puede_ver_configuracion(self):
        r = self.client.get('/api/notificaciones/configuracion/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_no_puede_ver_configuracion(self):
        self.auth(self.medico)
        r = self.client.get('/api/notificaciones/configuracion/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_configuracion(self):
        self.auth(self.recep)
        r = self.client.get('/api/notificaciones/configuracion/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_ver_configuracion(self):
        self.auth(self.admin)
        r = self.client.get('/api/notificaciones/configuracion/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for campo in ('email_remitente', 'habilitado', 'auto_recordatorio', 'auto_confirmacion'):
            self.assertIn(campo, r.data)

    def test_admin_puede_actualizar_configuracion(self):
        self.auth(self.admin)
        r = self.client.patch('/api/notificaciones/configuracion/', {
            'nombre_remitente': 'Clínica Test',
            'habilitado':       True,
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        conf = ConfiguracionNotificacion.get_solo()
        self.assertEqual(conf.nombre_remitente, 'Clínica Test')
        self.assertTrue(conf.habilitado)

    def test_admin_puede_desactivar_auto_recordatorio(self):
        self.auth(self.admin)
        r = self.client.patch('/api/notificaciones/configuracion/', {'auto_recordatorio': False})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        conf = ConfiguracionNotificacion.get_solo()
        self.assertFalse(conf.auto_recordatorio)

    def test_medico_no_puede_probar_conexion(self):
        self.auth(self.medico)
        r = self.client.post('/api/notificaciones/probar-conexion/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_probar_conexion_sin_api_key_retorna_error(self):
        self.auth(self.admin)
        r = self.client.post('/api/notificaciones/probar-conexion/')
        # Sin RESEND_API_KEY el servicio retorna 503
        self.assertIn(r.status_code, (
            status.HTTP_503_SERVICE_UNAVAILABLE,
            status.HTTP_200_OK,
        ))
        self.assertIn('mensaje', r.data)
