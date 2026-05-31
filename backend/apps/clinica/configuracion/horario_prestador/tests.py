from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from datetime import date, timedelta

from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador
from apps.administracion.persona_rrhh.models import PersonaRRHH
from apps.administracion.persona.models import TipoDocumento, Persona
from apps.clinica.configuracion.consultorio.models import Consultorio
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


def proximo_dia_semana(dia_id):
    """Devuelve la próxima fecha que cae en el dia_id dado (1=Lun, 7=Dom)."""
    hoy = date.today()
    target = dia_id - 1          # DiaSemana.id 1=Lun → weekday 0=Mon
    dias = (target - hoy.weekday()) % 7 or 7
    return hoy + timedelta(days=dias)


class BaseHorario(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('hp_admin',  'admin')
        self.recep  = crear_usuario('hp_recep',  'recepcionista')
        self.medico = crear_usuario('hp_medico', 'medico')

        self.tipo_doc   = TipoDocumento.objects.create(descripcion='CI HP Test')
        self.persona    = crear_persona('HP001', 'Pérez, Marcos Andrés', self.tipo_doc)
        self.prestador  = PersonaRRHH.objects.create(
            persona=self.persona,
            cargo='medico',
            tipo_contrato='dependencia',
        )
        self.consultorio = Consultorio.objects.create(nro_consultorio='HP-C1')
        self.dia,  _ = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})
        self.dia2, _ = DiaSemana.objects.get_or_create(id=2, defaults={'descripcion': 'Martes'})

        self.horario = HorarioPrestador.objects.create(
            persona_rrhh=self.prestador,
            consultorio=self.consultorio,
            dia_semana=self.dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class HorarioPermisosTest(BaseHorario):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/horario-prestador/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/horario-prestador/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/horario-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/horario-prestador/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear_sin_jwt(self):
        # force_authenticate sin JWT → rol=None → IsAdminOrRecepcionista → 403
        self.auth(self.medico)
        p = crear_persona('HP_MED_NO', 'Medico Sin JWT', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='medico', tipo_contrato='dependencia')
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': pres.id,
            'dia_semana': self.dia.id,
            'hora_desde': '08:00',
            'hora_hasta': '10:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/horario-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/horario-prestador/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        p = crear_persona('HP_REC_SI', 'Recep Puede Crear', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='enfermero', tipo_contrato='eventual')
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': pres.id,
            'dia_semana': self.dia.id,
            'hora_desde': '14:00',
            'hora_hasta': '18:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/horario-prestador/{self.horario.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/horario-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_generar_turnos(self):
        self.auth(self.recep)
        lunes = proximo_dia_semana(1)
        r = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', {
            'fecha_desde': str(lunes),
            'fecha_hasta': str(lunes),
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        p = crear_persona('HP_ADM_DEL', 'Admin Puede Eliminar', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='09:00', hora_hasta='11:00', intervalo=30,
        )
        r = self.client.delete(f'/api/horario-prestador/{h.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/horario-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class HorarioCrudTest(BaseHorario):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        p = crear_persona('HP_BORRA', 'Para Borrar HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h_borrado = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        h_borrado.soft_delete()
        r = self.client.get('/api/horario-prestador/')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.horario.id, ids)
        self.assertNotIn(h_borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/horario-prestador/')
        item = next(h for h in r.data['results'] if h['id'] == self.horario.id)
        for campo in ['id', 'persona_rrhh', 'dia_semana', 'hora_desde', 'hora_hasta',
                      'intervalo', 'estado', 'persona_rrhh_detalle', 'dia_semana_detalle']:
            self.assertIn(campo, item)

    def test_list_filtro_por_persona_rrhh(self):
        p = crear_persona('HP_OTRO_PRES', 'Otro Prestador', self.tipo_doc)
        pres2 = PersonaRRHH.objects.create(persona=p, cargo='enfermero', tipo_contrato='eventual')
        h2 = HorarioPrestador.objects.create(
            persona_rrhh=pres2, dia_semana=self.dia2,
            hora_desde='09:00', hora_hasta='13:00', intervalo=30,
        )
        r = self.client.get(f'/api/horario-prestador/?persona_rrhh={self.prestador.id}')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.horario.id, ids)
        self.assertNotIn(h2.id, ids)

    def test_list_filtro_por_estado(self):
        h_inact = HorarioPrestador.objects.create(
            persona_rrhh=self.prestador, dia_semana=self.dia2,
            hora_desde='14:00', hora_hasta='18:00', intervalo=30,
            estado='inactivo',
        )
        r_act = self.client.get('/api/horario-prestador/?estado=activo')
        r_ina = self.client.get('/api/horario-prestador/?estado=inactivo')
        ids_act = [h['id'] for h in r_act.data['results']]
        ids_ina = [h['id'] for h in r_ina.data['results']]
        self.assertIn(self.horario.id, ids_act)
        self.assertNotIn(self.horario.id, ids_ina)
        self.assertIn(h_inact.id, ids_ina)
        self.assertNotIn(h_inact.id, ids_act)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_horario(self):
        r = self.client.get(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['hora_desde'], '08:00:00')
        self.assertEqual(r.data['hora_hasta'], '12:00:00')
        self.assertEqual(r.data['intervalo'], 30)

    def test_retrieve_eliminado_retorna_404(self):
        p = crear_persona('HP_FANTAS', 'Fantasma HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        h.soft_delete()
        r = self.client.get(f'/api/horario-prestador/{h.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_retorna_404(self):
        r = self.client.get('/api/horario-prestador/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimo_valido(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '14:00',
            'hora_hasta': '18:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['intervalo'], 30)

    def test_create_con_consultorio(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '14:00',
            'hora_hasta': '18:00',
            'intervalo': 30,
            'consultorio': self.consultorio.id,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['consultorio'], self.consultorio.id)

    def test_create_excepcion_con_fecha(self):
        fecha = str(date.today() + timedelta(days=10))
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'excepcion': True,
            'fecha_excepcion': fecha,
            'hora_desde': '09:00',
            'hora_hasta': '11:00',
            'intervalo': 20,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r.data['excepcion'])
        self.assertEqual(r.data['fecha_excepcion'], fecha)

    def test_create_excepcion_asigna_dia_semana_automaticamente(self):
        # Un martes (weekday=1 → dia_id=2)
        prox_martes = proximo_dia_semana(2)
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'excepcion': True,
            'fecha_excepcion': str(prox_martes),
            'hora_desde': '10:00',
            'hora_hasta': '12:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['dia_semana'], 2)

    def test_create_sin_dia_semana_cuando_no_excepcion_retorna_400(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'hora_desde': '14:00',
            'hora_hasta': '18:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_excepcion_sin_fecha_retorna_400(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'excepcion': True,
            'hora_desde': '09:00',
            'hora_hasta': '11:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_hora_hasta_menor_a_desde_retorna_400(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '14:00',
            'hora_hasta': '10:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_hora_hasta_igual_a_desde_retorna_400(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '10:00',
            'hora_hasta': '10:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_intervalo_invalido_retorna_400(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '08:00',
            'hora_hasta': '12:00',
            'intervalo': 25,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_mismo_prestador_dia_hora_retorna_400(self):
        # self.horario ya tiene dia=Lunes, hora_desde=08:00
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia.id,
            'hora_desde': '08:00',
            'hora_hasta': '14:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_reutilizable_tras_borrado(self):
        p_reut   = crear_persona('HP_REUT', 'Reutilizable HP', self.tipo_doc)
        pres_reut = PersonaRRHH.objects.create(persona=p_reut, cargo='medico', tipo_contrato='dependencia')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres_reut, dia_semana=self.dia2,
            hora_desde='08:00', hora_hasta='12:00', intervalo=30,
        )
        h.soft_delete()
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': pres_reut.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '08:00',
            'hora_hasta': '12:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_estado_default_activo(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '14:00',
            'hora_hasta': '18:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        h = HorarioPrestador.objects.get(pk=r.data['id'])
        self.assertEqual(h.estado, HorarioPrestador.Estado.ACTIVO)

    def test_create_duplicado_excepcion_no_afecta_constraint(self):
        # Las excepciones no tienen constraint de unicidad
        fecha = str(date.today() + timedelta(days=5))
        self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'excepcion': True,
            'fecha_excepcion': fecha,
            'hora_desde': '08:00',
            'hora_hasta': '12:00',
            'intervalo': 30,
        })
        r2 = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'excepcion': True,
            'fecha_excepcion': fecha,
            'hora_desde': '08:00',
            'hora_hasta': '12:00',
            'intervalo': 30,
        })
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_estado(self):
        r = self.client.patch(f'/api/horario-prestador/{self.horario.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.horario.refresh_from_db()
        self.assertEqual(self.horario.estado, 'inactivo')

    def test_patch_intervalo(self):
        r = self.client.patch(f'/api/horario-prestador/{self.horario.id}/', {'intervalo': 20})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.horario.refresh_from_db()
        self.assertEqual(self.horario.intervalo, 20)

    def test_patch_consultorio(self):
        cons2 = Consultorio.objects.create(nro_consultorio='HP-C2')
        r = self.client.patch(f'/api/horario-prestador/{self.horario.id}/', {'consultorio': cons2.id})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.horario.refresh_from_db()
        self.assertEqual(self.horario.consultorio_id, cons2.id)

    def test_patch_mismo_estado_no_falla(self):
        r = self.client.patch(f'/api/horario-prestador/{self.horario.id}/', {'estado': 'activo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_hora_hasta_menor_que_desde_retorna_400(self):
        r = self.client.patch(
            f'/api/horario-prestador/{self.horario.id}/',
            {'hora_hasta': '07:00', 'hora_desde': '08:00'},
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_duplicado_de_otro_retorna_400(self):
        h2 = HorarioPrestador.objects.create(
            persona_rrhh=self.prestador, dia_semana=self.dia2,
            hora_desde='10:00', hora_hasta='14:00', intervalo=30,
        )
        # Intentar cambiar h2 a la misma combo que self.horario
        r = self.client.patch(f'/api/horario-prestador/{h2.id}/', {
            'dia_semana': self.dia.id,
            'hora_desde': '08:00',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_sin_turnos_marca_is_deleted(self):
        p = crear_persona('HP_DEL', 'Para Eliminar HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        r = self.client.delete(f'/api/horario-prestador/{h.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        h.refresh_from_db()
        self.assertTrue(h.is_deleted)
        self.assertIsNotNone(h.fecha_eliminacion)

    def test_destroy_eliminado_retorna_404(self):
        p = crear_persona('HP_YA_DEL', 'Ya Eliminado HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        h.soft_delete()
        r = self.client.delete(f'/api/horario-prestador/{h.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_no_aparece_en_list(self):
        p = crear_persona('HP_DEL2', 'Para Eliminar 2 HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        self.client.delete(f'/api/horario-prestador/{h.id}/')
        r = self.client.get('/api/horario-prestador/')
        ids = [item['id'] for item in r.data['results']]
        self.assertNotIn(h.id, ids)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        p = crear_persona('HP_ELIM', 'Para Eliminados HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        h.soft_delete()
        r = self.client.get('/api/horario-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in r.data]
        self.assertIn(h.id, ids)
        self.assertNotIn(self.horario.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/horario-prestador/eliminados/')
        self.assertIsInstance(r.data, list)

    # ── Generar turnos ────────────────────────────────────────────────────────

    def test_generar_turnos_devuelve_creados(self):
        lunes = proximo_dia_semana(1)
        r = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', {
            'fecha_desde': str(lunes),
            'fecha_hasta': str(lunes),
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('creados', r.data)
        self.assertGreater(r.data['creados'], 0)

    def test_generar_turnos_estructura_respuesta(self):
        lunes = proximo_dia_semana(1)
        r = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', {
            'fecha_desde': str(lunes),
            'fecha_hasta': str(lunes),
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for clave in ('creados', 'omitidos', 'detalle'):
            self.assertIn(clave, r.data)

    def test_generar_turnos_idempotente(self):
        lunes = proximo_dia_semana(1)
        datos = {'fecha_desde': str(lunes), 'fecha_hasta': str(lunes)}
        r1 = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', datos)
        r2 = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', datos)
        self.assertEqual(r2.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.data['creados'], 0)
        self.assertGreater(r2.data['omitidos'], 0)

    def test_generar_sin_fechas_retorna_400(self):
        r = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', {})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generar_fecha_hasta_menor_a_hoy_retorna_400(self):
        r = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', {
            'fecha_desde': '2000-01-01',
            'fecha_hasta': '2000-01-07',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generar_formato_invalido_retorna_400(self):
        r = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', {
            'fecha_desde': '01/06/2030',
            'fecha_hasta': '07/06/2030',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generar_sin_dia_coincidente_devuelve_cero_creados(self):
        # El horario es de Lunes; generamos solo en el rango de un martes y miércoles
        martes    = proximo_dia_semana(2)
        miercoles = martes + timedelta(days=1)
        r = self.client.post(f'/api/horario-prestador/{self.horario.id}/generar/', {
            'fecha_desde': str(martes),
            'fecha_hasta': str(miercoles),
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['creados'], 0)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Turnos activos bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class HorarioConstraintTest(BaseHorario):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

        from apps.clinica.agenda.models import Agenda
        from apps.clinica.paciente.models import Paciente

        self.Agenda = Agenda

        pac_persona  = crear_persona('HP_CON_PAC', 'Paciente Constraint HP', self.tipo_doc)
        self.paciente = Paciente.objects.create(persona=pac_persona, sexo='M')

    def _crear_turno(self, estado):
        return self.Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=self.paciente,
            fecha=str(proximo_dia_semana(1)),
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=estado,
        )

    def test_horario_con_turno_disponible_no_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.DISPONIBLE)
        r = self.client.delete(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.horario.refresh_from_db()
        self.assertFalse(self.horario.is_deleted)

    def test_horario_con_turno_ocupado_no_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.OCUPADO)
        r = self.client.delete(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_horario_con_turno_realizado_no_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.REALIZADO)
        r = self.client.delete(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_error_menciona_turnos(self):
        self._crear_turno(self.Agenda.Estado.OCUPADO)
        r = self.client.delete(f'/api/horario-prestador/{self.horario.id}/')
        self.assertIn('turn', str(r.data).lower())

    def test_horario_con_solo_turno_cancelado_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.CANCELADO)
        r = self.client.delete(f'/api/horario-prestador/{self.horario.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.horario.refresh_from_db()
        self.assertTrue(self.horario.is_deleted)

    def test_horario_sin_turnos_puede_eliminarse(self):
        p = crear_persona('HP_LIBRE', 'Sin Turnos HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        r = self.client.delete(f'/api/horario-prestador/{h.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class HorarioAuditoriaTest(BaseHorario):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '14:00',
            'hora_hasta': '18:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'HorarioPrestador')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/horario-prestador/{self.horario.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'HorarioPrestador')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        p = crear_persona('HP_AUD_D', 'Audit Delete HP', self.tipo_doc)
        pres = PersonaRRHH.objects.create(persona=p, cargo='otro', tipo_contrato='eventual')
        h = HorarioPrestador.objects.create(
            persona_rrhh=pres, dia_semana=self.dia,
            hora_desde='14:00', hora_hasta='16:00', intervalo=30,
        )
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/horario-prestador/{h.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'HorarioPrestador')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/horario-prestador/', {
            'persona_rrhh': self.prestador.id,
            'dia_semana': self.dia2.id,
            'hora_desde': '14:00',
            'hora_hasta': '18:00',
            'intervalo': 30,
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_no_nulos(self):
        r = self.client.patch(f'/api/horario-prestador/{self.horario.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
