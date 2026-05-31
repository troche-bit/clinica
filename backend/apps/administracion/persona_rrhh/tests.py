from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.administracion.persona_rrhh.models import PersonaRRHH
from apps.administracion.persona.models import TipoDocumento, Persona
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


def crear_persona(nro_documento, razon_social, tipo_doc):
    return Persona.objects.create(
        tipo_documento=tipo_doc,
        nro_documento=nro_documento,
        razon_social=razon_social,
    )


class BaseRRHH(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('rrhh_admin',  'admin')
        self.recep  = crear_usuario('rrhh_recep',  'recepcionista')
        self.medico = crear_usuario('rrhh_medico', 'medico')
        self.tipo_doc  = TipoDocumento.objects.create(descripcion='CI RRHH Test')
        self.persona   = crear_persona('RRHH001', 'Torres, Marta Elena', self.tipo_doc)
        self.prestador = PersonaRRHH.objects.create(
            persona=self.persona,
            cargo=PersonaRRHH.Cargo.MEDICO,
            tipo_contrato=PersonaRRHH.TipoContrato.DEPENDENCIA,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class RRHHPermisosTest(BaseRRHH):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/personarrhh/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/personarrhh/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/personarrhh/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/personarrhh/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        p = crear_persona('RRHH_M_NO', 'Medico No Puede', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/personarrhh/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/personarrhh/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_retrieve(self):
        self.auth(self.recep)
        r = self.client.get(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_crear(self):
        self.auth(self.recep)
        p = crear_persona('RRHH_R_NO', 'Recep No Puede', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/personarrhh/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        p = crear_persona('RRHH_ADM_SI', 'Admin Puede Crear', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        p = crear_persona('RRHH_ADM_DEL', 'Admin Puede Eliminar', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p,
            cargo=PersonaRRHH.Cargo.OTRO,
            tipo_contrato=PersonaRRHH.TipoContrato.EVENTUAL,
        )
        r = self.client.delete(f'/api/personarrhh/{pres.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/personarrhh/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class RRHHCrudTest(BaseRRHH):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        self.especialidad = Especialidad.objects.create(descripcion='Cardiología RRHH Test')

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        p = crear_persona('RRHH_BORRA', 'Para Borrar RRHH', self.tipo_doc)
        pres_borrado = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        pres_borrado.soft_delete()
        r = self.client.get('/api/personarrhh/')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.prestador.id, ids)
        self.assertNotIn(pres_borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/personarrhh/')
        item = next(p for p in r.data['results'] if p['id'] == self.prestador.id)
        for campo in ['id', 'nombre', 'documento', 'cargo', 'tipo_contrato', 'estado', 'persona_detalle']:
            self.assertIn(campo, item)

    def test_list_busqueda_por_razon_social(self):
        r = self.client.get('/api/personarrhh/?search=Torres')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.prestador.id, ids)

    def test_list_busqueda_por_nro_documento(self):
        r = self.client.get('/api/personarrhh/?search=RRHH001')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.prestador.id, ids)

    def test_list_busqueda_por_matricula(self):
        self.prestador.nro_matricula = 'MAT-12345'
        self.prestador.save()
        r = self.client.get('/api/personarrhh/?search=MAT-12345')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.prestador.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_prestador(self):
        r = self.client.get(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['documento'], 'RRHH001')
        self.assertEqual(r.data['cargo'], 'medico')

    def test_retrieve_eliminado_retorna_404(self):
        p = crear_persona('RRHH_FANTAS', 'Fantasma RRHH', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        pres.soft_delete()
        r = self.client.get(f'/api/personarrhh/{pres.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_retorna_404(self):
        r = self.client.get('/api/personarrhh/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimo_valido(self):
        p = crear_persona('RRHH002', 'López, Pedro José', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'enfermero',
            'tipo_contrato': 'honorarios',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['cargo'], 'enfermero')

    def test_create_con_campos_opcionales(self):
        p = crear_persona('RRHH003', 'García, Ana María', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
            'estado': 'activo',
            'nro_matricula': 'MED-99001',
            'especialidades': [self.especialidad.id],
            'honorario': '5000000.00',
            'observacion': 'Cardiólogo especialista',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_matricula'], 'MED-99001')

    def test_create_sin_persona_retorna_400(self):
        r = self.client.post('/api/personarrhh/', {
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_cargo_retorna_400(self):
        p = crear_persona('RRHH_NO_C', 'Sin Cargo RRHH', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'tipo_contrato': 'dependencia',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_tipo_contrato_retorna_400(self):
        p = crear_persona('RRHH_NO_TC', 'Sin Tipo Contrato', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_cargo_invalido_retorna_400(self):
        p = crear_persona('RRHH_INV_C', 'Cargo Invalido', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'invalido',
            'tipo_contrato': 'dependencia',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_tipo_contrato_invalido_retorna_400(self):
        p = crear_persona('RRHH_INV_TC', 'Tipo Contrato Invalido', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'invalido',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_honorario_negativo_retorna_400(self):
        p = crear_persona('RRHH_HON_NEG', 'Honorario Negativo', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
            'honorario': '-100.00',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_fecha_ingreso_futura_retorna_400(self):
        p = crear_persona('RRHH_FEC_FUT', 'Fecha Futura', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
            'fecha_ingreso': '2099-01-01',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_strip_nro_matricula(self):
        p = crear_persona('RRHH_STRIP', 'Strip Matricula', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
            'nro_matricula': '  MAT-STRIP  ',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_matricula'], 'MAT-STRIP')

    def test_create_strip_observacion(self):
        p = crear_persona('RRHH_STRIP2', 'Strip Observacion', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'enfermero',
            'tipo_contrato': 'eventual',
            'observacion': '  Con espacios alrededor  ',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['observacion'], 'Con espacios alrededor')

    def test_create_estado_default_activo(self):
        p = crear_persona('RRHH_DEF_EST', 'Estado Default RRHH', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'tecnico',
            'tipo_contrato': 'eventual',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        pres = PersonaRRHH.objects.get(pk=r.data['id'])
        self.assertEqual(pres.estado, PersonaRRHH.Estado.ACTIVO)

    def test_create_reutilizable_tras_borrado(self):
        self.prestador.soft_delete()
        r = self.client.post('/api/personarrhh/', {
            'persona': self.persona.id,
            'cargo': 'medico',
            'tipo_contrato': 'honorarios',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_estado(self):
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'estado': 'inactivo'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.prestador.refresh_from_db()
        self.assertEqual(self.prestador.estado, 'inactivo')

    def test_patch_cargo(self):
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'cargo': 'tecnico'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.prestador.refresh_from_db()
        self.assertEqual(self.prestador.cargo, 'tecnico')

    def test_patch_nro_matricula(self):
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'nro_matricula': 'MAT-UPD-01'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.prestador.refresh_from_db()
        self.assertEqual(self.prestador.nro_matricula, 'MAT-UPD-01')

    def test_patch_mismo_cargo_no_falla(self):
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'cargo': 'medico'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_honorario_negativo_retorna_400(self):
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'honorario': '-500'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_estado_invalido_retorna_400(self):
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'estado': 'jubilado'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_agrega_especialidad(self):
        r = self.client.patch(
            f'/api/personarrhh/{self.prestador.id}/',
            {'especialidades': [self.especialidad.id]},
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.prestador.refresh_from_db()
        self.assertIn(self.especialidad, self.prestador.especialidades.all())

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_sin_turnos_marca_is_deleted(self):
        p = crear_persona('RRHH_DEL', 'Para Eliminar RRHH', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        r = self.client.delete(f'/api/personarrhh/{pres.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        pres.refresh_from_db()
        self.assertTrue(pres.is_deleted)
        self.assertIsNotNone(pres.fecha_eliminacion)

    def test_destroy_eliminado_retorna_404(self):
        p = crear_persona('RRHH_YA_DEL', 'Ya Eliminado RRHH', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        pres.soft_delete()
        r = self.client.delete(f'/api/personarrhh/{pres.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_no_aparece_en_list(self):
        p = crear_persona('RRHH_DEL2', 'Para Eliminar 2 RRHH', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        self.client.delete(f'/api/personarrhh/{pres.id}/')
        r = self.client.get('/api/personarrhh/')
        ids = [item['id'] for item in r.data['results']]
        self.assertNotIn(pres.id, ids)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        p = crear_persona('RRHH_ELIM', 'Para Eliminados RRHH', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        pres.soft_delete()
        r = self.client.get('/api/personarrhh/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in r.data]
        self.assertIn(pres.id, ids)
        self.assertNotIn(self.prestador.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/personarrhh/eliminados/')
        self.assertIsInstance(r.data, list)

    # ── Buscar ────────────────────────────────────────────────────────────────

    def test_buscar_prestador_existente(self):
        r = self.client.get('/api/personarrhh/buscar/?nro_documento=RRHH001')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['es_prestador'])
        self.assertIsNotNone(r.data['personarrhh'])
        self.assertEqual(r.data['personarrhh']['id'], self.prestador.id)

    def test_buscar_persona_sin_prestador(self):
        p = crear_persona('RRHH_SINPRES', 'Sin Prestador RRHH', self.tipo_doc)
        r = self.client.get('/api/personarrhh/buscar/?nro_documento=RRHH_SINPRES')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['es_prestador'])
        self.assertIsNone(r.data['personarrhh'])
        self.assertIsNotNone(r.data['persona'])

    def test_buscar_inexistente_devuelve_todo_none(self):
        r = self.client.get('/api/personarrhh/buscar/?nro_documento=NOEXISTE999')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsNone(r.data['persona'])
        self.assertFalse(r.data['es_prestador'])

    def test_buscar_sin_parametro_retorna_400(self):
        r = self.client.get('/api/personarrhh/buscar/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Validar matrícula ─────────────────────────────────────────────────────

    def test_validar_matricula_disponible(self):
        r = self.client.get('/api/personarrhh/validar-matricula/?nro_matricula=MAT-LIBRE')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['disponible'])

    def test_validar_matricula_ocupada(self):
        self.prestador.nro_matricula = 'MAT-OCUP'
        self.prestador.save()
        r = self.client.get('/api/personarrhh/validar-matricula/?nro_matricula=MAT-OCUP')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['disponible'])

    def test_validar_matricula_con_exclude_propio(self):
        self.prestador.nro_matricula = 'MAT-EXCL'
        self.prestador.save()
        r = self.client.get(
            f'/api/personarrhh/validar-matricula/?nro_matricula=MAT-EXCL&exclude_id={self.prestador.id}'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['disponible'])

    def test_validar_matricula_vacia_es_disponible(self):
        r = self.client.get('/api/personarrhh/validar-matricula/?nro_matricula=')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['disponible'])


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Turnos activos bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class RRHHConstraintTest(BaseRRHH):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

        from apps.clinica.configuracion.consultorio.models import Consultorio
        from apps.mantenimiento.diasemana.models import DiaSemana
        from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador
        from apps.clinica.agenda.models import Agenda
        from apps.clinica.paciente.models import Paciente

        self.Agenda = Agenda
        self.HorarioPrestador = HorarioPrestador

        consultorio    = Consultorio.objects.create(nro_consultorio='RRHH-C1')
        dia, _         = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})
        self.horario   = HorarioPrestador.objects.create(
            persona_rrhh=self.prestador,
            consultorio=consultorio,
            dia_semana=dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )
        pac_persona    = crear_persona('RRHH_CON_PAC', 'Paciente Constraint RRHH', self.tipo_doc)
        self.paciente  = Paciente.objects.create(persona=pac_persona, sexo='M')

    def _crear_turno(self, estado):
        return self.Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=self.paciente,
            fecha='2026-07-01',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=estado,
        )

    def test_prestador_con_turno_disponible_no_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.DISPONIBLE)
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.prestador.refresh_from_db()
        self.assertFalse(self.prestador.is_deleted)

    def test_prestador_con_turno_ocupado_no_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.OCUPADO)
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_prestador_con_turno_realizado_no_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.REALIZADO)
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_error_menciona_turnos(self):
        self._crear_turno(self.Agenda.Estado.OCUPADO)
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertIn('turn', str(r.data).lower())

    def test_prestador_con_solo_turno_cancelado_puede_eliminarse(self):
        self._crear_turno(self.Agenda.Estado.CANCELADO)
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.prestador.refresh_from_db()
        self.assertTrue(self.prestador.is_deleted)

    def test_destroy_soft_delete_horario_vinculado(self):
        r = self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.horario.refresh_from_db()
        self.assertTrue(self.horario.is_deleted)

    def test_destroy_soft_delete_agenda_vinculada(self):
        turno = self._crear_turno(self.Agenda.Estado.CANCELADO)
        self.client.delete(f'/api/personarrhh/{self.prestador.id}/')
        turno.refresh_from_db()
        self.assertTrue(turno.is_deleted)

    def test_prestador_sin_turnos_puede_eliminarse(self):
        p = crear_persona('RRHH_LIBRE', 'Sin Turnos RRHH', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        r = self.client.delete(f'/api/personarrhh/{pres.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class RRHHAuditoriaTest(BaseRRHH):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        p = crear_persona('RRHH_AUD_C', 'Audit Crear RRHH', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'medico',
            'tipo_contrato': 'dependencia',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PersonaRRHH')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'estado': 'licencia'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PersonaRRHH')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        p = crear_persona('RRHH_AUD_D', 'Audit Delete RRHH', self.tipo_doc)
        pres = PersonaRRHH.objects.create(
            persona=p, cargo='otro', tipo_contrato='eventual'
        )
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/personarrhh/{pres.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PersonaRRHH')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        p = crear_persona('RRHH_AUD_U', 'Audit Usuario RRHH', self.tipo_doc)
        r = self.client.post('/api/personarrhh/', {
            'persona': p.id,
            'cargo': 'tecnico',
            'tipo_contrato': 'eventual',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_no_nulos(self):
        r = self.client.patch(f'/api/personarrhh/{self.prestador.id}/', {'estado': 'licencia'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
