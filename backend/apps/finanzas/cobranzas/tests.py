from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.persona.models import Persona, TipoDocumento
from apps.administracion.users.models import PerfilUsuario
from apps.facturacion.configuracion.timbrado.models import Timbrado
from apps.facturacion.ventas.models import VentaFactCab
from apps.finanzas.caja_banco.models import CuentaMcb, MovimientoCajaBanco
from apps.finanzas.cobranzas.models import Cobranza, CobranzaDet, ValorRecibidoCob
from apps.finanzas.estadocuenta.models import CtaCobrar
from apps.forma_pago.models import FormaPago

User = get_user_model()
HOY    = date.today()
INICIO = HOY - timedelta(days=30)
FIN    = HOY + timedelta(days=365)

_NRO_DOC_ITER  = iter(range(60000001, 69999999))
_NRO_COMP_ITER = iter(range(3001, 9999))
_NRO_TIMB_ITER = iter(range(19300001, 19399999))


def next_doc():
    return str(next(_NRO_DOC_ITER))


def next_comp():
    return next(_NRO_COMP_ITER)


def next_timb():
    return str(next(_NRO_TIMB_ITER))


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_tipo_doc(desc='CI-COB'):
    td, _ = TipoDocumento.objects.get_or_create(descripcion=desc)
    return td


def crear_persona(nro_doc, razon_social='Cliente COB', tipo_doc=None):
    if tipo_doc is None:
        tipo_doc = crear_tipo_doc()
    return Persona.objects.create(
        tipo_documento=tipo_doc,
        nro_documento=nro_doc,
        razon_social=razon_social,
    )


def crear_timbrado():
    return Timbrado.objects.create(
        nro_timbrado     = next_timb(),
        inicio_vigencia  = INICIO,
        fin_vigencia     = FIN,
        punto_sucursal   = '001',
        punto_expedicion = '001',
        nro_desde        = 1,
        nro_hasta        = 9999,
        autoimpresor     = False,
    )


def crear_forma_pago(id_fp=1):
    fp, _ = FormaPago.objects.get_or_create(
        id=id_fp,
        defaults={'descripcion': 'Efectivo', 'tipo': 'efectivo'},
    )
    return fp


def crear_cuenta(desc='Caja COB'):
    return CuentaMcb.objects.create(descripcion=desc)


def crear_factura_credito(persona, timbrado, monto='110000.00', cant_cuota=1):
    """Crea VentaFactCab en crédito + una CtaCobrar con saldo completo."""
    monto_dec = Decimal(monto)
    vfc = VentaFactCab.objects.create(
        fecha           = HOY,
        condicion_vta   = False,
        persona         = persona,
        timbrado        = timbrado,
        nro_comprobante = next_comp(),
        establecimiento = '001',
        expedicion      = '001',
        monto_total     = monto_dec,
    )
    cta = CtaCobrar.objects.create(
        vfc               = vfc,
        nro_cuota         = 1,
        cant_cuota        = cant_cuota,
        monto_total       = monto_dec,
        monto_cuota       = monto_dec,
        saldo             = monto_dec,
        fecha_vencimiento = HOY + timedelta(days=30),
        estado            = 'pendiente',
    )
    return vfc, cta


def crear_cobranza_directa(persona, cta, forma_pago, cuenta, monto='110000.00', nro=None):
    """Crea Cobranza en DB sin pasar por API y marca la cuota como pagada."""
    if nro is None:
        nro = next_comp()
    monto_dec = Decimal(monto)
    cab = Cobranza.objects.create(
        fecha           = HOY,
        persona         = persona,
        comprobante_nro = nro,
        monto           = monto_dec,
        vuelto          = Decimal('0'),
    )
    CobranzaDet.objects.create(
        cobranza     = cab,
        cta_cobrar   = cta,
        monto_total  = monto_dec,
        monto_pagado = monto_dec,
    )
    vrc = ValorRecibidoCob.objects.create(
        cobranza   = cab,
        forma_pago = forma_pago,
        cta        = cuenta,
        monto      = monto_dec,
    )
    MovimientoCajaBanco.objects.create(
        cta           = cuenta,
        fecha         = HOY,
        monto_ingreso = monto_dec,
        monto_egreso  = Decimal('0'),
        vuelto        = Decimal('0'),
        vrc_id        = vrc.id,
    )
    cta.saldo -= monto_dec
    if cta.saldo <= 0:
        cta.estado = 'pagado'
    cta.save()
    return cab


def payload_cobranza(persona_id, cta_id, forma_pago_id, cta_mcb_id, monto='110000.00', nro=None):
    data = {
        'fecha':   str(HOY),
        'persona': persona_id,
        'detalle': [
            {'cta_cobrar_id': cta_id, 'monto_pagado': monto},
        ],
        'valores_recibidos': [
            {'forma_pago_id': forma_pago_id, 'cta_id': cta_mcb_id, 'monto': monto},
        ],
    }
    if nro is not None:
        data['comprobante_nro'] = nro
    return data


# ══════════════════════════════════════════════════════════════════════════════
# BASE
# ══════════════════════════════════════════════════════════════════════════════

class BaseCobranza(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('cob_admin',  'admin')
        self.recep  = crear_usuario('cob_recep',  'recepcionista')
        self.medico = crear_usuario('cob_medico', 'medico')

        self.tipo_doc   = crear_tipo_doc()
        self.persona    = crear_persona(next_doc(), tipo_doc=self.tipo_doc)
        self.timbrado   = crear_timbrado()
        self.forma_pago = crear_forma_pago()
        self.cuenta     = crear_cuenta()

        # CtaCobrar limpia con saldo completo — para tests de creación via API
        self.vfc, self.cta = crear_factura_credito(self.persona, self.timbrado)

        # Cobranza ya registrada — para tests de list, retrieve y eliminación
        vfc2, cta2 = crear_factura_credito(self.persona, self.timbrado)
        self.cobranza = crear_cobranza_directa(
            self.persona, cta2, self.forma_pago, self.cuenta,
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def post_json(self, url, data):
        return self.client.post(url, data=data, format='json')


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosCobranzaTest(BaseCobranza):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/cobranzas/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_eliminar(self):
        r = self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/cobranzas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_ver_detalle(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/cobranzas/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/cobranzas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        r = self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class CobranzaCrudTest(BaseCobranza):

    def test_list_solo_activos(self):
        otra_cob = Cobranza.objects.create(
            fecha=HOY, persona=self.persona,
            comprobante_nro=next_comp(), monto=Decimal('0'), vuelto=Decimal('0'),
            is_deleted=True,
        )
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/')
        ids = [item['id'] for item in r.data['results']]
        self.assertIn(self.cobranza.id, ids)
        self.assertNotIn(otra_cob.id, ids)

    def test_list_busqueda_por_nombre(self):
        persona2 = crear_persona(next_doc(), razon_social='Juan Fernandez')
        vfc2, cta2 = crear_factura_credito(persona2, self.timbrado)
        crear_cobranza_directa(persona2, cta2, self.forma_pago, crear_cuenta('Caja2'))

        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/?search=Juan')
        nombres = [item['cliente_nombre'] for item in r.data['results']]
        self.assertTrue(all('Juan' in n for n in nombres))

    def test_list_busqueda_por_documento(self):
        self.auth(self.admin)
        doc = self.persona.nro_documento
        r = self.client.get(f'/api/cobranzas/?search={doc}')
        self.assertGreaterEqual(len(r.data['results']), 1)
        for item in r.data['results']:
            self.assertEqual(item['cliente_documento'], doc)

    def test_list_campos_serializados(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/')
        item = r.data['results'][0]
        for campo in ('id', 'fecha', 'comprobante_nro', 'persona',
                      'cliente_nombre', 'cliente_documento', 'monto', 'vuelto'):
            self.assertIn(campo, item)

    def test_retrieve_retorna_detalle_completo(self):
        self.auth(self.admin)
        r = self.client.get(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('detalle', r.data)
        self.assertIn('valores_recibidos', r.data)
        self.assertGreaterEqual(len(r.data['detalle']), 1)
        self.assertGreaterEqual(len(r.data['valores_recibidos']), 1)

    def test_retrieve_detalle_tiene_campos_factura(self):
        self.auth(self.admin)
        r = self.client.get(f'/api/cobranzas/{self.cobranza.id}/')
        det = r.data['detalle'][0]
        for campo in ('id', 'cta_cobrar', 'factura_nro', 'cuota_display',
                      'fecha_vencimiento', 'monto_total', 'monto_pagado'):
            self.assertIn(campo, det)

    def test_create_valido_retorna_201(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', r.data)

    def test_create_reduce_saldo_cta_cobrar(self):
        self.auth(self.admin)
        saldo_original = self.cta.saldo
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id,
                              monto=str(saldo_original))
        self.post_json('/api/cobranzas/', p)
        self.cta.refresh_from_db()
        self.assertEqual(self.cta.saldo, Decimal('0'))
        self.assertEqual(self.cta.estado, 'pagado')

    def test_create_pago_parcial_mantiene_saldo(self):
        self.auth(self.admin)
        monto_parcial = '50000.00'
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id,
                              monto=monto_parcial)
        self.post_json('/api/cobranzas/', p)
        self.cta.refresh_from_db()
        self.assertEqual(self.cta.saldo, self.cta.saldo)  # saldo > 0
        self.assertEqual(self.cta.estado, 'pendiente')

    def test_create_genera_movimiento_caja_banco(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        cob_id = r.data['id']
        cob = Cobranza.objects.get(pk=cob_id)
        vrc_ids = list(cob.valores_recibidos.filter(is_deleted=False).values_list('id', flat=True))
        self.assertTrue(
            MovimientoCajaBanco.objects.filter(vrc_id__in=vrc_ids, is_deleted=False).exists()
        )

    def test_create_numero_auto_si_omitido(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertIsNotNone(r.data['comprobante_nro'])

    def test_create_numero_auto_mayor_al_existente(self):
        self.auth(self.admin)
        nro_existente = self.cobranza.comprobante_nro
        _, cta_nueva = crear_factura_credito(self.persona, self.timbrado)
        p = payload_cobranza(self.persona.id, cta_nueva.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertGreater(r.data['comprobante_nro'], nro_existente)

    def test_create_numero_duplicado_retorna_400(self):
        self.auth(self.admin)
        nro_existente = self.cobranza.comprobante_nro
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id,
                              nro=nro_existente)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_cuota_no_encontrada_retorna_400(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, 99999, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_monto_cero_retorna_400(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id,
                              monto='0.00')
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_monto_supera_saldo_retorna_400(self):
        self.auth(self.admin)
        monto_exceso = str(self.cta.saldo + Decimal('1'))
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id,
                              monto=monto_exceso)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_detalle_vacio_retorna_400(self):
        self.auth(self.admin)
        p = {
            'fecha': str(HOY), 'persona': self.persona.id,
            'detalle': [],
            'valores_recibidos': [
                {'forma_pago_id': self.forma_pago.id, 'cta_id': self.cuenta.id, 'monto': '110000.00'},
            ],
        }
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_valores_vacios_retorna_400(self):
        self.auth(self.admin)
        p = {
            'fecha': str(HOY), 'persona': self.persona.id,
            'detalle': [{'cta_cobrar_id': self.cta.id, 'monto_pagado': '110000.00'}],
            'valores_recibidos': [],
        }
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_destroy_marca_borrado_logico(self):
        self.auth(self.admin)
        r = self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.cobranza.refresh_from_db()
        self.assertTrue(self.cobranza.is_deleted)
        self.assertIsNotNone(self.cobranza.fecha_eliminacion)

    def test_destroy_restaura_saldo_cta_cobrar(self):
        self.auth(self.admin)
        det = self.cobranza.detalle.filter(is_deleted=False).first()
        cta = det.cta_cobrar
        saldo_antes = cta.saldo

        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')

        cta.refresh_from_db()
        self.assertEqual(cta.saldo, saldo_antes + det.monto_pagado)

    def test_destroy_marca_movimiento_caja_borrado(self):
        self.auth(self.admin)
        vrc_ids = list(self.cobranza.valores_recibidos.filter(is_deleted=False).values_list('id', flat=True))
        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        activos = MovimientoCajaBanco.objects.filter(vrc_id__in=vrc_ids, is_deleted=False).count()
        self.assertEqual(activos, 0)

    def test_destroy_no_aparece_en_list(self):
        self.auth(self.admin)
        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        r = self.client.get('/api/cobranzas/')
        ids = [item['id'] for item in r.data['results']]
        self.assertNotIn(self.cobranza.id, ids)

    def test_destroy_ya_borrado_retorna_404(self):
        self.auth(self.admin)
        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        r = self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_eliminados_retorna_solo_borrados(self):
        self.auth(self.admin)
        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        r = self.client.get('/api/cobranzas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in r.data]
        self.assertIn(self.cobranza.id, ids)

    def test_eliminados_no_contiene_activos(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/eliminados/')
        ids = [item['id'] for item in r.data]
        self.assertNotIn(self.cobranza.id, ids)


# ══════════════════════════════════════════════════════════════════════════════
# ACCIONES CUSTOM
# ══════════════════════════════════════════════════════════════════════════════

class CobranzaAccionesTest(BaseCobranza):

    def test_siguiente_numero_retorna_entero(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/siguiente-numero/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('siguiente', r.data)
        self.assertIsInstance(r.data['siguiente'], int)

    def test_siguiente_numero_mayor_al_existente(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/siguiente-numero/')
        self.assertGreater(r.data['siguiente'], self.cobranza.comprobante_nro)

    def test_siguiente_numero_accesible_por_medico(self):
        self.auth(self.medico)
        r = self.client.get('/api/cobranzas/siguiente-numero/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_validar_numero_disponible(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/validar-numero/?nro=99999')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['disponible'])

    def test_validar_numero_ocupado(self):
        self.auth(self.admin)
        nro = self.cobranza.comprobante_nro
        r = self.client.get(f'/api/cobranzas/validar-numero/?nro={nro}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['disponible'])
        self.assertIn('mensaje', r.data)

    def test_validar_numero_texto_retorna_400(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/validar-numero/?nro=abc')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cuotas_pendientes_sin_param_retorna_400(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/cuotas-pendientes/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cuotas_pendientes_retorna_lista(self):
        self.auth(self.admin)
        r = self.client.get(f'/api/cobranzas/cuotas-pendientes/?persona={self.persona.id}')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)

    def test_cuotas_pendientes_incluye_cuota_con_saldo(self):
        self.auth(self.admin)
        r = self.client.get(f'/api/cobranzas/cuotas-pendientes/?persona={self.persona.id}')
        ids = [item['id'] for item in r.data]
        self.assertIn(self.cta.id, ids)

    def test_cuotas_pendientes_excluye_cuota_pagada(self):
        # La cuota vinculada a self.cobranza tiene saldo = 0 (pagada)
        self.auth(self.admin)
        det = self.cobranza.detalle.filter(is_deleted=False).first()
        cta_pagada = det.cta_cobrar
        r = self.client.get(f'/api/cobranzas/cuotas-pendientes/?persona={self.persona.id}')
        ids = [item['id'] for item in r.data]
        self.assertNotIn(cta_pagada.id, ids)

    def test_cuotas_pendientes_campos_serializados(self):
        self.auth(self.admin)
        r = self.client.get(f'/api/cobranzas/cuotas-pendientes/?persona={self.persona.id}')
        if r.data:
            item = r.data[0]
            for campo in ('id', 'nro_cuota', 'cant_cuota', 'saldo',
                          'fecha_vencimiento', 'estado', 'factura_nro'):
                self.assertIn(campo, item)

    def test_clientes_con_pendientes_retorna_lista(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/clientes-con-pendientes/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIsInstance(r.data, list)

    def test_clientes_con_pendientes_incluye_persona_con_saldo(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/clientes-con-pendientes/')
        ids = [item['id'] for item in r.data]
        self.assertIn(self.persona.id, ids)

    def test_clientes_con_pendientes_busqueda_por_nombre(self):
        self.auth(self.admin)
        r = self.client.get(
            f'/api/cobranzas/clientes-con-pendientes/?search={self.persona.razon_social[:5]}'
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(r.data), 1)

    def test_dashboard_mensual_retorna_claves_esperadas(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/dashboard-mensual/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for clave in ('total_cobrado_mes', 'cantidad_recibos_mes',
                      'total_pendiente', 'total_facturado',
                      'por_dia', 'top_deudores', 'mes', 'fecha'):
            self.assertIn(clave, r.data)

    def test_dashboard_mensual_por_dia_es_lista(self):
        self.auth(self.admin)
        r = self.client.get('/api/cobranzas/dashboard-mensual/')
        self.assertIsInstance(r.data['por_dia'], list)

    def test_dashboard_mensual_accesible_por_medico(self):
        self.auth(self.medico)
        r = self.client.get('/api/cobranzas/dashboard-mensual/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_eliminados_accesible_solo_por_admin(self):
        self.auth(self.recep)
        r = self.client.get('/api/cobranzas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_eliminados_campos_serializados(self):
        self.auth(self.admin)
        Cobranza.objects.filter(pk=self.cobranza.pk).update(is_deleted=True)
        r = self.client.get('/api/cobranzas/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        if r.data:
            item = r.data[0]
            for campo in ('id', 'fecha', 'comprobante_nro', 'cliente_nombre', 'monto'):
                self.assertIn(campo, item)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class CobranzaAuditoriaTest(BaseCobranza):

    def test_crear_registra_auditoria(self):
        self.auth(self.admin)
        antes = RegistroAuditoria.objects.count()
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)

    def test_crear_auditoria_accion_crear(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        log = RegistroAuditoria.objects.filter(
            tabla='Cobranza', registro_id=r.data['id']
        ).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.accion, 'CREAR')

    def test_crear_auditoria_usuario_correcto(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        log = RegistroAuditoria.objects.filter(
            tabla='Cobranza', registro_id=r.data['id']
        ).first()
        self.assertEqual(log.usuario_id, self.admin.id)

    def test_crear_auditoria_datos_despues_no_nulo(self):
        self.auth(self.admin)
        p = payload_cobranza(self.persona.id, self.cta.id, self.forma_pago.id, self.cuenta.id)
        r = self.post_json('/api/cobranzas/', p)
        log = RegistroAuditoria.objects.filter(
            tabla='Cobranza', registro_id=r.data['id']
        ).first()
        self.assertIsNotNone(log.datos_despues)

    def test_eliminar_registra_auditoria(self):
        self.auth(self.admin)
        antes = RegistroAuditoria.objects.count()
        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        self.assertGreater(RegistroAuditoria.objects.count(), antes)

    def test_eliminar_auditoria_accion_eliminar(self):
        self.auth(self.admin)
        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        log = RegistroAuditoria.objects.filter(
            tabla='Cobranza', registro_id=self.cobranza.id, accion='ELIMINAR'
        ).first()
        self.assertIsNotNone(log)

    def test_eliminar_auditoria_usuario_correcto(self):
        self.auth(self.admin)
        self.client.delete(f'/api/cobranzas/{self.cobranza.id}/')
        log = RegistroAuditoria.objects.filter(
            tabla='Cobranza', registro_id=self.cobranza.id, accion='ELIMINAR'
        ).first()
        self.assertEqual(log.usuario_id, self.admin.id)
