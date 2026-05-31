from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.clinica.paciente.models import Paciente
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


class BasePaciente(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('pac_admin',  'admin')
        self.recep  = crear_usuario('pac_recep',  'recepcionista')
        self.medico = crear_usuario('pac_medico', 'medico')
        self.tipo_doc = TipoDocumento.objects.create(descripcion='CI Paciente Test')
        self.persona  = crear_persona('PAC001', 'González, Ana María', self.tipo_doc)
        self.paciente = Paciente.objects.create(persona=self.persona, sexo='F')

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PacientePermisosTest(BasePaciente):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/paciente/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/paciente/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/paciente/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/paciente/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/paciente/{self.paciente.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        persona2 = crear_persona('PAC_MED_NO', 'Médico No Puede', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': persona2.id, 'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/paciente/{self.paciente.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/paciente/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/paciente/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        persona2 = crear_persona('PAC_RECEP_SI', 'Recep Puede Crear', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': persona2.id, 'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/paciente/{self.paciente.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/paciente/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        p = crear_persona('PAC_ADMIN_DEL', 'Admin Puede Eliminar', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/paciente/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class PacienteCrudTest(BasePaciente):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        p = crear_persona('PAC_BORRA', 'Para Borrar', self.tipo_doc)
        pac_borrado = Paciente.objects.create(persona=p, sexo='M')
        pac_borrado.soft_delete()
        r = self.client.get('/api/paciente/')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.paciente.id, ids)
        self.assertNotIn(pac_borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/paciente/')
        item = next(p for p in r.data['results'] if p['id'] == self.paciente.id)
        for campo in ['id', 'nombre', 'documento', 'sexo', 'persona_detalle']:
            self.assertIn(campo, item)

    def test_list_busqueda_por_razon_social(self):
        r = self.client.get('/api/paciente/?search=González')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.paciente.id, ids)

    def test_list_busqueda_por_nro_documento(self):
        r = self.client.get('/api/paciente/?search=PAC001')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.paciente.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_paciente(self):
        r = self.client.get(f'/api/paciente/{self.paciente.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['documento'], 'PAC001')
        self.assertEqual(r.data['sexo'], 'F')

    def test_retrieve_eliminado_retorna_404(self):
        p = crear_persona('PAC_FANTAS', 'Fantasma', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        pac.soft_delete()
        r = self.client.get(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_retorna_404(self):
        r = self.client.get('/api/paciente/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_minimo_valido(self):
        p = crear_persona('PAC002', 'Martínez, Pedro', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': p.id, 'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['sexo'], 'M')

    def test_create_con_campos_opcionales(self):
        p = crear_persona('PAC003', 'López, Rosa', self.tipo_doc)
        r = self.client.post('/api/paciente/', {
            'persona': p.id,
            'sexo': 'F',
            'grupo_sanguineo': 'O+',
            'alergias_conocidas': 'Penicilina',
            'enfermedades_cronicas': 'Diabetes tipo 2',
            'observacion': 'Controles trimestrales',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['grupo_sanguineo'], 'O+')

    def test_create_sin_sexo_retorna_400(self):
        p = crear_persona('PAC004', 'Sin Sexo', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': p.id})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sexo_invalido_retorna_400(self):
        p = crear_persona('PAC005', 'Sexo Invalido', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': p.id, 'sexo': 'X'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_persona_retorna_400(self):
        r = self.client.post('/api/paciente/', {'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_persona_ya_tiene_paciente_activo_retorna_400(self):
        # self.persona ya tiene self.paciente activo → duplicado
        r = self.client.post('/api/paciente/', {'persona': self.persona.id, 'sexo': 'F'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sexo_otro_es_valido(self):
        p = crear_persona('PAC_OTRO', 'Sexo Otro', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': p.id, 'sexo': 'O'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_grupo_sanguineo_invalido_retorna_400(self):
        p = crear_persona('PAC_GS', 'Grupo Invalido', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': p.id, 'sexo': 'M', 'grupo_sanguineo': 'C+'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_strip_campos_texto(self):
        p = crear_persona('PAC_STRIP', 'Strip Test', self.tipo_doc)
        r = self.client.post('/api/paciente/', {
            'persona': p.id,
            'sexo': 'M',
            'observacion': '  Con espacios  ',
            'alergias_conocidas': '  Polen  ',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['observacion'], 'Con espacios')
        self.assertEqual(r.data['alergias_conocidas'], 'Polen')

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_sexo(self):
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.paciente.refresh_from_db()
        self.assertEqual(self.paciente.sexo, 'M')

    def test_patch_alergias(self):
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'alergias_conocidas': 'Ibuprofeno'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.paciente.refresh_from_db()
        self.assertEqual(self.paciente.alergias_conocidas, 'Ibuprofeno')

    def test_patch_grupo_sanguineo(self):
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'grupo_sanguineo': 'A+'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.paciente.refresh_from_db()
        self.assertEqual(self.paciente.grupo_sanguineo, 'A+')

    def test_patch_sexo_invalido_retorna_400(self):
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'sexo': 'Z'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_sin_citas_marca_is_deleted(self):
        p = crear_persona('PAC_DEL', 'Para Eliminar', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        pac.refresh_from_db()
        self.assertTrue(pac.is_deleted)
        self.assertIsNotNone(pac.fecha_eliminacion)

    def test_destroy_eliminado_retorna_404(self):
        p = crear_persona('PAC_YA_DEL', 'Ya Eliminado', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        pac.soft_delete()
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_no_aparece_en_list(self):
        p = crear_persona('PAC_DEL2', 'Para Eliminar 2', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        self.client.delete(f'/api/paciente/{pac.id}/')
        r = self.client.get('/api/paciente/')
        ids = [item['id'] for item in r.data['results']]
        self.assertNotIn(pac.id, ids)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        p = crear_persona('PAC_ELIM', 'Para Eliminados', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        pac.soft_delete()
        r = self.client.get('/api/paciente/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in r.data]
        self.assertIn(pac.id, ids)
        self.assertNotIn(self.paciente.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/paciente/eliminados/')
        self.assertIsInstance(r.data, list)

    # ── Count ─────────────────────────────────────────────────────────────────

    def test_count_retorna_total_activos(self):
        r = self.client.get('/api/paciente/count/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('count', r.data)
        self.assertGreaterEqual(r.data['count'], 1)

    def test_count_no_incluye_borrados(self):
        p = crear_persona('PAC_CNT_DEL', 'Count Borrado', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        r1 = self.client.get('/api/paciente/count/')
        pac.soft_delete()
        r2 = self.client.get('/api/paciente/count/')
        self.assertEqual(r2.data['count'], r1.data['count'] - 1)

    # ── Dashboard ─────────────────────────────────────────────────────────────

    def test_dashboard_mensual_retorna_200(self):
        r = self.client.get('/api/paciente/dashboard-mensual/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_dashboard_mensual_estructura_basica(self):
        r = self.client.get('/api/paciente/dashboard-mensual/')
        for clave in ['mes_label', 'total_mes', 'por_dia', 'por_sexo',
                      'por_grupo_etario', 'por_departamento', 'tendencia_6meses']:
            self.assertIn(clave, r.data)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Citas activas bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class PacienteConstraintTest(BasePaciente):
    """
    Verifica que un paciente con citas activas (disponible/ocupado/realizado)
    no puede eliminarse, y que canceladas o ninguna sí permiten el borrado.
    """

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

        from apps.administracion.persona_rrhh.models import PersonaRRHH
        from apps.clinica.configuracion.consultorio.models import Consultorio
        from apps.mantenimiento.diasemana.models import DiaSemana
        from apps.clinica.configuracion.horario_prestador.models import HorarioPrestador
        from apps.clinica.agenda.models import Agenda

        self.Agenda = Agenda

        persona_rrhh = crear_persona('PAC_RRHH', 'Prestador Constraint', self.tipo_doc)
        rrhh         = PersonaRRHH.objects.create(persona=persona_rrhh)
        consultorio  = Consultorio.objects.create(nro_consultorio='PAC-C1')
        dia, _       = DiaSemana.objects.get_or_create(id=1, defaults={'descripcion': 'Lunes'})
        self.horario = HorarioPrestador.objects.create(
            persona_rrhh=rrhh,
            consultorio=consultorio,
            dia_semana=dia,
            hora_desde='08:00',
            hora_hasta='12:00',
            intervalo=30,
        )

    def _crear_cita(self, paciente, estado):
        return self.Agenda.objects.create(
            horario_prestador=self.horario,
            paciente=paciente,
            fecha='2026-06-01',
            hora_desde='08:00',
            hora_hasta='08:30',
            estado=estado,
        )

    def test_paciente_con_cita_ocupada_no_puede_eliminarse(self):
        p = crear_persona('PAC_OCUP', 'Con Cita Ocupada', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        self._crear_cita(pac, self.Agenda.Estado.OCUPADO)
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        pac.refresh_from_db()
        self.assertFalse(pac.is_deleted)

    def test_paciente_con_cita_disponible_no_puede_eliminarse(self):
        p = crear_persona('PAC_DISP', 'Con Cita Disponible', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='F')
        self._crear_cita(pac, self.Agenda.Estado.DISPONIBLE)
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_paciente_con_cita_realizada_no_puede_eliminarse(self):
        p = crear_persona('PAC_REAL', 'Con Cita Realizada', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        self._crear_cita(pac, self.Agenda.Estado.REALIZADO)
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_error_menciona_citas(self):
        p = crear_persona('PAC_ERR_MSG', 'Error Msg Cita', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='F')
        self._crear_cita(pac, self.Agenda.Estado.OCUPADO)
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertIn('cit', str(r.data).lower())

    def test_paciente_con_solo_cita_cancelada_puede_eliminarse(self):
        p = crear_persona('PAC_CANC', 'Cita Cancelada', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        self._crear_cita(pac, self.Agenda.Estado.CANCELADO)
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        pac.refresh_from_db()
        self.assertTrue(pac.is_deleted)

    def test_paciente_sin_citas_puede_eliminarse(self):
        p = crear_persona('PAC_NO_CITA', 'Sin Citas', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='F')
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class PacienteAuditoriaTest(BasePaciente):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        p = crear_persona('PAC_AUD_C', 'Audit Crear', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': p.id, 'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Paciente')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'sexo': 'M'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Paciente')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        p = crear_persona('PAC_AUD_D', 'Audit Delete', self.tipo_doc)
        pac = Paciente.objects.create(persona=p, sexo='M')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/paciente/{pac.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Paciente')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        p = crear_persona('PAC_AUD_U', 'Audit Usuario', self.tipo_doc)
        r = self.client.post('/api/paciente/', {'persona': p.id, 'sexo': 'F'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_snapshots_no_nulos(self):
        r = self.client.patch(f'/api/paciente/{self.paciente.id}/', {'alergias_conocidas': 'Audit Snap'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
