import itertools
from datetime import date, time, timedelta
from decimal import Decimal

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
from apps.finanzas.caja_banco.models import CuentaMcb, MovimientoCajaBanco
from apps.finanzas.pago_prestador.models import PagoPrestador, PagoPrestadorDetCobranza
from apps.forma_pago.models import FormaPago
from apps.mantenimiento.diasemana.models import DiaSemana

User = get_user_model()
HOY = date.today()

_NRO_DOC_ITER  = iter(range(70000001, 79999999))
_HORA_COUNTER  = itertools.count(0)  # contador infinito — módulo 48 para mantenerse en rango 24h


def next_doc():
    return str(next(_NRO_DOC_ITER))


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_tipo_doc(desc='CI-PP'):
    td, _ = TipoDocumento.objects.get_or_create(descripcion=desc)
    return td


def crear_persona(nro_doc, razon_social='Prestador PP', tipo_doc=None):
    if tipo_doc is None:
        tipo_doc = crear_tipo_doc()
    return Persona.objects.create(
        tipo_documento=tipo_doc,
        nro_documento=nro_doc,
        razon_social=razon_social,
    )


def crear_medico(persona=None):
    if persona is None:
        persona = crear_persona(next_doc())
    return PersonaRRHH.objects.create(
        persona=persona,
        cargo=PersonaRRHH.Cargo.MEDICO,
    )


def crear_consultorio(desc='Cons PP'):
    c, _ = Consultorio.objects.get_or_create(descripcion=desc)
    return c


def crear_dia_semana(id_dia=1, desc='Lunes'):
    d, _ = DiaSemana.objects.get_or_create(id=id_dia, defaults={'descripcion': desc})
    return d


def crear_horario(medico, consultorio=None, dia=None):
    if consultorio is None:
        consultorio = crear_consultorio()
    if dia is None:
        dia = crear_dia_semana()
    return HorarioPrestador.objects.create(
        persona_rrhh=medico,
        consultorio=consultorio,
        dia_semana=dia,
        hora_desde=time(8, 0),
        hora_hasta=time(12, 0),
        intervalo=30,
        estado='activo',
        excepcion=False,
    )


def next_hora():
    minutos = (next(_HORA_COUNTER) % 48) * 30  # cicla 0..47 → 00:00, 00:30, …, 23:30
    return time(minutos // 60, minutos % 60)


def crear_turno(horario, fecha=None, pagado=False):
    if fecha is None:
        fecha = HOY
    h_desde = next_hora()
    h_hasta = time(h_desde.hour, h_desde.minute + 29) if h_desde.minute < 31 else time(h_desde.hour + 1, 0)
    return Agenda.objects.create(
        horario_prestador=horario,
        fecha=fecha,
        hora_desde=h_desde,
        hora_hasta=h_hasta,
        estado=Agenda.Estado.DISPONIBLE,
        pagado_prestador=pagado,
    )


def crear_forma_pago(id_fp=1):
    fp, _ = FormaPago.objects.get_or_create(
        id=id_fp,
        defaults={'descripcion': 'Efectivo', 'tipo': 'efectivo'},
    )
    return fp


def crear_cuenta(desc='Caja PP'):
    return CuentaMcb.objects.create(descripcion=desc)


def payload_pago(medico, horario, turno, forma_pago, cuenta, nro=None, monto_hora='50000.00'):
    p = {
        'persona_rrhh_id': medico.id,
        'fecha_pago':       str(HOY),
        'monto_hora':       monto_hora,
        'bloques': [
            {
                'horario_prestador_id': horario.id,
                'fecha':      str(HOY),
                'horas':      '4.00',
                'agenda_ids': [turno.id],
            }
        ],
        'valores_pagados': [
            {
                'forma_pago_id': forma_pago.id,
                'cta_id':        cuenta.id,
                'monto':         '200000.00',
                'voucher':       '',
            }
        ],
    }
    if nro is not None:
        p['nro_comprobante'] = nro
    return p


# ══════════════════════════════════════════════════════════════════════════════
# BASE
# ══════════════════════════════════════════════════════════════════════════════

class BasePagoPrestador(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('pp_admin',  'admin')
        self.recep  = crear_usuario('pp_recep',  'recepcionista')
        self.medico = crear_usuario('pp_medico', 'medico')

        self.tipo_doc   = crear_tipo_doc()
        self.persona    = crear_persona(next_doc(), tipo_doc=self.tipo_doc)
        self.prestador  = crear_medico(persona=self.persona)
        self.consultorio = crear_consultorio()
        self.dia        = crear_dia_semana()
        self.horario    = crear_horario(self.prestador, self.consultorio, self.dia)
        self.turno      = crear_turno(self.horario)
        self.forma_pago = crear_forma_pago()
        self.cuenta     = crear_cuenta()

        self.pago = PagoPrestador.objects.create(
            persona_rrhh    = self.prestador,
            nro_comprobante = 9901,
            fecha_pago      = HOY,
            monto_hora      = Decimal('50000.00'),
            total_hora      = Decimal('4.00'),
            monto_total     = Decimal('200000.00'),
            saldo           = Decimal('0'),
            estado          = 'pagado',
            id_usu_creator  = self.admin,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def post_pago(self, turno=None, nro=None):
        if turno is None:
            turno = crear_turno(self.horario)
        return self.client.post(
            '/api/pago-prestador/',
            data=payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta, nro=nro),
            format='json',
        )


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosPagoPrestadorTest(BasePagoPrestador):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/pago-prestador/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/pago-prestador/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_eliminar(self):
        r = self.client.delete(f'/api/pago-prestador/{self.pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/pago-prestador/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/pago-prestador/{self.pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/pago-prestador/{self.pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/pago-prestador/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_crear(self):
        self.auth(self.recep)
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/pago-prestador/{self.pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        pago = PagoPrestador.objects.create(
            persona_rrhh=self.prestador, fecha_pago=HOY,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
            id_usu_creator=self.admin,
        )
        r = self.client.delete(f'/api/pago-prestador/{pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/pago-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/pago-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/pago-prestador/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_puede_ver_siguiente_numero(self):
        self.auth(self.medico)
        r = self.client.get('/api/pago-prestador/siguiente-numero/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_ver_bloques_pendientes(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/pago-prestador/bloques-pendientes/?persona_rrhh={self.prestador.id}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_ver_medicos_con_pendientes(self):
        self.auth(self.medico)
        r = self.client.get('/api/pago-prestador/medicos-con-pendientes/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_validar_numero(self):
        self.auth(self.medico)
        r = self.client.get('/api/pago-prestador/validar-numero/?nro=9999')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class PagoPrestadorCrudTest(BasePagoPrestador):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        pago_borrado = PagoPrestador.objects.create(
            persona_rrhh=self.prestador, fecha_pago=HOY,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
            id_usu_creator=self.admin,
        )
        pago_borrado.soft_delete()
        r = self.client.get('/api/pago-prestador/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.pago.id, ids)
        self.assertNotIn(pago_borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/pago-prestador/')
        item = next(x for x in r.data['results'] if x['id'] == self.pago.id)
        for campo in ['id', 'nro_comprobante', 'fecha_pago', 'persona_rrhh',
                      'medico_nombre', 'monto_hora', 'total_hora', 'monto_total',
                      'saldo', 'estado', 'estado_display', 'fecha_creacion']:
            self.assertIn(campo, item)

    def test_list_busqueda_por_razon_social(self):
        persona2 = crear_persona(next_doc(), razon_social='Buscable PP Test')
        prestador2 = crear_medico(persona=persona2)
        PagoPrestador.objects.create(
            persona_rrhh=prestador2, fecha_pago=HOY,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
        )
        r = self.client.get('/api/pago-prestador/?search=Buscable PP')
        ids = [x['id'] for x in r.data['results']]
        self.assertTrue(len(ids) >= 1)
        nombres = [x['medico_nombre'] for x in r.data['results'] if x['id'] in ids]
        self.assertTrue(any('Buscable PP' in n for n in nombres))

    def test_list_filtro_por_persona_rrhh(self):
        persona2 = crear_persona(next_doc())
        prestador2 = crear_medico(persona=persona2)
        PagoPrestador.objects.create(
            persona_rrhh=prestador2, fecha_pago=HOY,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
        )
        r = self.client.get(f'/api/pago-prestador/?persona_rrhh={self.prestador.id}')
        for item in r.data['results']:
            self.assertEqual(item['persona_rrhh'], self.prestador.id)

    def test_list_filtro_por_estado(self):
        PagoPrestador.objects.create(
            persona_rrhh=self.prestador, fecha_pago=HOY,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('25000'), estado='parcial',
        )
        r = self.client.get('/api/pago-prestador/?estado=pagado')
        for item in r.data['results']:
            self.assertEqual(item['estado'], 'pagado')

    def test_list_filtro_fecha_desde(self):
        ayer = HOY - timedelta(days=1)
        PagoPrestador.objects.create(
            persona_rrhh=self.prestador, fecha_pago=ayer,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
        )
        r = self.client.get(f'/api/pago-prestador/?fecha_desde={HOY}')
        for item in r.data['results']:
            self.assertGreaterEqual(item['fecha_pago'], str(HOY))

    def test_list_filtro_fecha_hasta(self):
        manana = HOY + timedelta(days=1)
        PagoPrestador.objects.create(
            persona_rrhh=self.prestador, fecha_pago=manana,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
        )
        r = self.client.get(f'/api/pago-prestador/?fecha_hasta={HOY}')
        for item in r.data['results']:
            self.assertLessEqual(item['fecha_pago'], str(HOY))

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_pago(self):
        r = self.client.get(f'/api/pago-prestador/{self.pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['id'], self.pago.id)

    def test_retrieve_incluye_detalle_cobranza(self):
        r = self.client.get(f'/api/pago-prestador/{self.pago.id}/')
        self.assertIn('detalle_cobranza', r.data)

    def test_retrieve_eliminado_devuelve_404(self):
        self.pago.soft_delete()
        r = self.client.get(f'/api/pago-prestador/{self.pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/pago-prestador/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido_retorna_201(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_calcula_monto_total(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertGreater(Decimal(str(r.data['monto_total'])), 0)

    def test_create_estado_pagado_cuando_pago_cubre_total(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['estado'], 'pagado')
        self.assertEqual(Decimal(str(r.data['saldo'])), Decimal('0'))

    def test_create_estado_pendiente_cuando_pago_es_cero(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        payload['valores_pagados'][0]['monto'] = '0.00'
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['estado'], 'pendiente')
        self.assertGreater(Decimal(str(r.data['saldo'])), 0)

    def test_create_estado_parcial_cuando_pago_es_menor_al_total(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        payload['valores_pagados'][0]['monto'] = '100000.00'
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['estado'], 'parcial')

    def test_create_crea_movimiento_caja_egreso(self):
        turno = crear_turno(self.horario)
        antes = MovimientoCajaBanco.objects.filter(is_deleted=False, cta=self.cuenta).count()
        self.post_pago(turno=turno)
        self.assertGreater(
            MovimientoCajaBanco.objects.filter(is_deleted=False, cta=self.cuenta).count(),
            antes,
        )

    def test_create_movimiento_caja_es_egreso(self):
        turno = crear_turno(self.horario)
        self.post_pago(turno=turno)
        mov = MovimientoCajaBanco.objects.filter(is_deleted=False, cta=self.cuenta).latest('id')
        self.assertGreater(mov.monto_egreso, 0)
        self.assertEqual(mov.monto_ingreso, Decimal('0'))

    def test_create_crea_detalle_cobranza(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        self.assertTrue(
            PagoPrestadorDetCobranza.objects.filter(pago_prestador_id=pago_id, is_deleted=False).exists()
        )

    def test_create_marca_turnos_como_pagados(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        turno.refresh_from_db()
        self.assertTrue(turno.pagado_prestador)
        self.assertEqual(turno.pago_prestador_id, pago_id)

    def test_create_asigna_nro_comprobante_automatico(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        self.assertIsNotNone(r.data['nro_comprobante'])
        self.assertGreater(r.data['nro_comprobante'], 0)

    def test_create_con_nro_comprobante_explicito(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno, nro=8801)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_comprobante'], 8801)

    def test_create_nro_duplicado_retorna_400(self):
        turno1 = crear_turno(self.horario)
        self.post_pago(turno=turno1, nro=8802)
        turno2 = crear_turno(self.horario, fecha=HOY - timedelta(days=1))
        r = self.post_pago(turno=turno2, nro=8802)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('comprobante', str(r.data).lower())

    def test_create_nro_duplicado_borrado_es_valido(self):
        turno1 = crear_turno(self.horario)
        r1 = self.post_pago(turno=turno1, nro=8803)
        pago_ant = PagoPrestador.objects.get(pk=r1.data['id'])
        pago_ant.soft_delete()
        turno2 = crear_turno(self.horario, fecha=HOY - timedelta(days=1))
        r2 = self.post_pago(turno=turno2, nro=8803)
        self.assertEqual(r2.status_code, status.HTTP_201_CREATED)

    def test_create_prestador_inexistente_retorna_400(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        payload['persona_rrhh_id'] = 99999
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_bloques_retorna_400(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        payload['bloques'] = []
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_valores_pagados_retorna_400(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        payload['valores_pagados'] = []
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_total_pagado_supera_monto_total_retorna_400(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        payload['valores_pagados'][0]['monto'] = '999999999.00'
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('monto', str(r.data).lower())

    def test_create_cuenta_inexistente_retorna_400(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        payload['valores_pagados'][0]['cta_id'] = 99999
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_fecha_pago_retorna_400(self):
        turno = crear_turno(self.horario)
        payload = payload_pago(self.prestador, self.horario, turno, self.forma_pago, self.cuenta)
        del payload['fecha_pago']
        r = self.client.post('/api/pago-prestador/', data=payload, format='json')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        del_r = self.client.delete(f'/api/pago-prestador/{pago_id}/')
        self.assertEqual(del_r.status_code, status.HTTP_204_NO_CONTENT)
        pago = PagoPrestador.objects.get(pk=pago_id)
        self.assertTrue(pago.is_deleted)
        self.assertIsNotNone(pago.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        self.client.delete(f'/api/pago-prestador/{pago_id}/')
        r_list = self.client.get('/api/pago-prestador/')
        ids = [x['id'] for x in r_list.data['results']]
        self.assertNotIn(pago_id, ids)

    def test_destroy_ya_borrado_retorna_404(self):
        self.pago.soft_delete()
        r = self.client.delete(f'/api/pago-prestador/{self.pago.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_borra_detalle_cobranza(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        self.client.delete(f'/api/pago-prestador/{pago_id}/')
        self.assertFalse(
            PagoPrestadorDetCobranza.objects.filter(pago_prestador_id=pago_id, is_deleted=False).exists()
        )

    def test_destroy_borra_movimientos_caja(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        det_ids = list(
            PagoPrestadorDetCobranza.objects.filter(pago_prestador_id=pago_id).values_list('id', flat=True)
        )
        self.client.delete(f'/api/pago-prestador/{pago_id}/')
        self.assertFalse(
            MovimientoCajaBanco.objects.filter(ppdc_id__in=det_ids, is_deleted=False).exists()
        )

    def test_destroy_desmarca_turnos_pagados(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        self.client.delete(f'/api/pago-prestador/{pago_id}/')
        turno.refresh_from_db()
        self.assertFalse(turno.pagado_prestador)
        self.assertIsNone(turno.pago_prestador_id)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_devuelve_solo_borrados(self):
        pago_borrado = PagoPrestador.objects.create(
            persona_rrhh=self.prestador, fecha_pago=HOY,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
        )
        pago_borrado.soft_delete()
        r = self.client.get('/api/pago-prestador/eliminados/')
        ids = [x['id'] for x in r.data]
        self.assertIn(pago_borrado.id, ids)
        self.assertNotIn(self.pago.id, ids)


# ══════════════════════════════════════════════════════════════════════════════
# ACCIONES PERSONALIZADAS
# ══════════════════════════════════════════════════════════════════════════════

class PagoPrestadorAccionesTest(BasePagoPrestador):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── siguiente_numero ──────────────────────────────────────────────────────

    def test_siguiente_numero_retorna_maximo_mas_uno(self):
        from django.db.models import Max
        max_nro = PagoPrestador.objects.filter(
            is_deleted=False, nro_comprobante__isnull=False,
        ).aggregate(m=Max('nro_comprobante'))['m'] or 0
        r = self.client.get('/api/pago-prestador/siguiente-numero/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('siguiente', r.data)
        self.assertEqual(r.data['siguiente'], max_nro + 1)

    def test_siguiente_numero_ignora_borrados(self):
        pago_borrado = PagoPrestador.objects.create(
            persona_rrhh=self.prestador, nro_comprobante=9999, fecha_pago=HOY,
            monto_hora=Decimal('50000'), total_hora=Decimal('1'),
            monto_total=Decimal('50000'), saldo=Decimal('0'), estado='pagado',
        )
        pago_borrado.soft_delete()
        r = self.client.get('/api/pago-prestador/siguiente-numero/')
        self.assertNotEqual(r.data['siguiente'], 10000)

    # ── validar_numero ────────────────────────────────────────────────────────

    def test_validar_numero_disponible(self):
        r = self.client.get('/api/pago-prestador/validar-numero/?nro=7777')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['disponible'])
        self.assertEqual(r.data['mensaje'], '')

    def test_validar_numero_ya_registrado(self):
        r = self.client.get(f'/api/pago-prestador/validar-numero/?nro={self.pago.nro_comprobante}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['disponible'])
        self.assertIn(str(self.pago.nro_comprobante), r.data['mensaje'])

    def test_validar_numero_invalido_retorna_no_disponible(self):
        r = self.client.get('/api/pago-prestador/validar-numero/?nro=abc')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['disponible'])

    def test_validar_numero_cero_retorna_no_disponible(self):
        r = self.client.get('/api/pago-prestador/validar-numero/?nro=0')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['disponible'])

    def test_validar_numero_sin_param_retorna_no_disponible(self):
        r = self.client.get('/api/pago-prestador/validar-numero/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['disponible'])

    # ── bloques_pendientes ────────────────────────────────────────────────────

    def test_bloques_pendientes_sin_persona_rrhh_retorna_400(self):
        r = self.client.get('/api/pago-prestador/bloques-pendientes/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bloques_pendientes_retorna_lista(self):
        turno_pendiente = crear_turno(self.horario)
        r = self.client.get(f'/api/pago-prestador/bloques-pendientes/?persona_rrhh={self.prestador.id}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)

    def test_bloques_pendientes_no_incluye_turnos_pagados(self):
        turno_pagado = crear_turno(self.horario, pagado=True)
        r = self.client.get(f'/api/pago-prestador/bloques-pendientes/?persona_rrhh={self.prestador.id}')
        agenda_ids_totales = []
        for bloque in r.data:
            agenda_ids_totales.extend(bloque['agenda_ids'])
        self.assertNotIn(turno_pagado.id, agenda_ids_totales)

    def test_bloques_pendientes_incluye_turnos_no_pagados(self):
        turno_pendiente = crear_turno(self.horario, fecha=HOY - timedelta(days=1))
        r = self.client.get(f'/api/pago-prestador/bloques-pendientes/?persona_rrhh={self.prestador.id}')
        agenda_ids_totales = []
        for bloque in r.data:
            agenda_ids_totales.extend(bloque['agenda_ids'])
        self.assertIn(turno_pendiente.id, agenda_ids_totales)

    def test_bloques_pendientes_campos_esperados(self):
        crear_turno(self.horario, fecha=HOY - timedelta(days=2))
        r = self.client.get(f'/api/pago-prestador/bloques-pendientes/?persona_rrhh={self.prestador.id}')
        if r.data:
            bloque = r.data[0]
            for campo in ['horario_prestador_id', 'fecha', 'hora_desde', 'hora_hasta', 'horas', 'agenda_ids']:
                self.assertIn(campo, bloque)

    def test_bloques_pendientes_filtro_fecha_hasta(self):
        fecha_antigua = HOY - timedelta(days=10)
        turno_antiguo = crear_turno(self.horario, fecha=fecha_antigua)
        turno_reciente = crear_turno(self.horario, fecha=HOY)
        ayer = HOY - timedelta(days=1)
        r = self.client.get(
            f'/api/pago-prestador/bloques-pendientes/?persona_rrhh={self.prestador.id}&fecha_hasta={ayer}'
        )
        agenda_ids = []
        for bloque in r.data:
            agenda_ids.extend(bloque['agenda_ids'])
        self.assertIn(turno_antiguo.id, agenda_ids)
        self.assertNotIn(turno_reciente.id, agenda_ids)

    # ── medicos_con_pendientes ────────────────────────────────────────────────

    def test_medicos_con_pendientes_retorna_lista(self):
        r = self.client.get('/api/pago-prestador/medicos-con-pendientes/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)

    def test_medicos_con_pendientes_campos_esperados(self):
        crear_turno(self.horario, fecha=HOY - timedelta(days=1))
        r = self.client.get('/api/pago-prestador/medicos-con-pendientes/')
        if r.data:
            m = r.data[0]
            for campo in ['id', 'nombre', 'documento']:
                self.assertIn(campo, m)

    def test_medicos_con_pendientes_filtro_search(self):
        persona2 = crear_persona(next_doc(), razon_social='BuscarPP Medico Test')
        prestador2 = crear_medico(persona=persona2)
        horario2 = crear_horario(prestador2, dia=crear_dia_semana(id_dia=2, desc='Martes'))
        crear_turno(horario2, fecha=HOY - timedelta(days=1))
        r = self.client.get('/api/pago-prestador/medicos-con-pendientes/?search=BuscarPP')
        nombres = [m['nombre'] for m in r.data]
        self.assertTrue(any('BuscarPP' in n for n in nombres))


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class PagoPrestadorAuditoriaTest(BasePagoPrestador):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        turno = crear_turno(self.horario)
        self.post_pago(turno=turno)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PagoPrestador')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_create_registra_usuario_correcto(self):
        turno = crear_turno(self.horario)
        self.post_pago(turno=turno)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_create_datos_antes_nulo_datos_despues_no_nulo(self):
        turno = crear_turno(self.horario)
        self.post_pago(turno=turno)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)

    def test_destroy_registra_auditoria(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        antes = RegistroAuditoria.objects.count()
        self.client.delete(f'/api/pago-prestador/{pago_id}/')
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'PagoPrestador')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_destroy_datos_antes_no_nulo(self):
        turno = crear_turno(self.horario)
        r = self.post_pago(turno=turno)
        pago_id = r.data['id']
        self.client.delete(f'/api/pago-prestador/{pago_id}/')
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
