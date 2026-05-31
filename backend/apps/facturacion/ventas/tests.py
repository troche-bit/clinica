from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Max
from rest_framework import status
from rest_framework.test import APITestCase

from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.persona.models import Persona, TipoDocumento
from apps.administracion.users.models import PerfilUsuario
from apps.facturacion.configuracion.timbrado.models import Timbrado
from apps.facturacion.ventas.models import VentaFactCab, VentaFactDet, VentaFactDetCobranza
from apps.finanzas.caja_banco.models import CuentaMcb, MovimientoCajaBanco
from apps.finanzas.cobranzas.models import Cobranza, CobranzaDet
from apps.finanzas.estadocuenta.models import CtaCobrar
from apps.forma_pago.models import FormaPago
from apps.stock.productos.models import Grupo, ProductoServicio

User = get_user_model()
HOY    = date.today()
INICIO = HOY - timedelta(days=30)
FIN    = HOY + timedelta(days=365)

_NRO_ITER = iter(range(1001, 9800))


def next_nro():
    return next(_NRO_ITER)


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_tipo_doc(desc='CI-VF'):
    td, _ = TipoDocumento.objects.get_or_create(descripcion=desc)
    return td


def crear_persona(nro_doc, razon_social='Cliente VF', tipo_doc=None):
    if tipo_doc is None:
        tipo_doc = crear_tipo_doc()
    return Persona.objects.create(
        tipo_documento=tipo_doc,
        nro_documento=nro_doc,
        razon_social=razon_social,
    )


def crear_timbrado(**kwargs):
    defaults = {
        'nro_timbrado':    '19100001',
        'inicio_vigencia': INICIO,
        'fin_vigencia':    FIN,
        'punto_sucursal':  '001',
        'punto_expedicion': '001',
        'nro_desde':       1,
        'nro_hasta':       9999,
        'autoimpresor':    False,
    }
    defaults.update(kwargs)
    return Timbrado.objects.create(**defaults)


def crear_grupo(**kwargs):
    defaults = {'descripcion': 'Servicios VF', 'activo': True}
    defaults.update(kwargs)
    return Grupo.objects.create(**defaults)


def crear_producto(grupo, **kwargs):
    defaults = {
        'descripcion': 'Consulta VF',
        'grupo': grupo,
        'impuesto': ProductoServicio.IVA_10,
        'activo': True,
    }
    defaults.update(kwargs)
    return ProductoServicio.objects.create(**defaults)


def crear_forma_pago(id_fp=1):
    fp, _ = FormaPago.objects.get_or_create(
        id=id_fp,
        defaults={'descripcion': 'Efectivo', 'tipo': 'efectivo'},
    )
    return fp


def crear_cuenta(**kwargs):
    defaults = {'descripcion': 'Caja VF'}
    defaults.update(kwargs)
    return CuentaMcb.objects.create(**defaults)


def payload_contado(timbrado, persona, producto, forma_pago, cta, nro=None):
    return {
        'fecha':           str(HOY),
        'condicion_vta':   True,
        'persona':         persona.id,
        'timbrado':        timbrado.id,
        'nro_comprobante': nro if nro is not None else next_nro(),
        'detalle': [
            {'prs': producto.id, 'cantidad': '1.00', 'monto': '110000.00'},
        ],
        'cobranza': [
            {'forma_pago': forma_pago.id, 'cta': cta.id, 'monto': '110000.00'},
        ],
    }


def payload_credito(timbrado, persona, producto, nro=None):
    return {
        'fecha':           str(HOY),
        'condicion_vta':   False,
        'persona':         persona.id,
        'timbrado':        timbrado.id,
        'nro_comprobante': nro if nro is not None else next_nro(),
        'detalle': [
            {'prs': producto.id, 'cantidad': '1.00', 'monto': '110000.00'},
        ],
        'cuotas': {'cant_cuota': 3, 'dias_entre_cuotas': 30},
    }


# ══════════════════════════════════════════════════════════════════════════════
# BASE
# ══════════════════════════════════════════════════════════════════════════════

class BaseVentaFact(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('vf_admin',  'admin')
        self.recep  = crear_usuario('vf_recep',  'recepcionista')
        self.medico = crear_usuario('vf_medico', 'medico')

        self.tipo_doc   = crear_tipo_doc()
        self.persona    = crear_persona('88700001', tipo_doc=self.tipo_doc)
        self.timbrado   = crear_timbrado()
        self.grupo      = crear_grupo()
        self.producto   = crear_producto(self.grupo)
        self.forma_pago = crear_forma_pago()
        self.cta        = crear_cuenta()

        self.factura = VentaFactCab.objects.create(
            fecha           = HOY,
            condicion_vta   = True,
            persona         = self.persona,
            timbrado        = self.timbrado,
            nro_comprobante = next_nro(),
            establecimiento = '001',
            expedicion      = '001',
            monto_total     = Decimal('110000.00'),
            grav_10         = Decimal('100000.00'),
            iva_10          = Decimal('10000.00'),
        )

    def auth(self, user):
        self.client.force_authenticate(user=user)

    def post_json(self, url, data):
        return self.client.post(url, data=data, format='json')


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosVentaFactTest(BaseVentaFact):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/facturacion/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/facturacion/', {})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_eliminar(self):
        r = self.client.delete(f'/api/facturacion/{self.factura.id}/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/facturacion/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/facturacion/{self.factura.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/facturacion/{self.factura.id}/', {'observacion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/facturacion/{self.factura.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_puede_ver_dashboard(self):
        self.auth(self.medico)
        r = self.client.get('/api/facturacion/dashboard-mensual/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/facturacion/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/facturacion/{self.factura.id}/', {'observacion': 'Obs recep'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/facturacion/{self.factura.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_editar(self):
        self.auth(self.admin)
        r = self.client.patch(f'/api/facturacion/{self.factura.id}/', {'observacion': 'Obs admin'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        fact = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        r = self.client.delete(f'/api/facturacion/{fact.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_pdf_anonimo_permitido(self):
        r = self.client.get(f'/api/facturacion/{self.factura.id}/pdf/')
        self.assertNotEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotEqual(r.status_code, status.HTTP_403_FORBIDDEN)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class VentaFactCrudTest(BaseVentaFact):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrada = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        borrada.soft_delete()
        r = self.client.get('/api/facturacion/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.factura.id, ids)
        self.assertNotIn(borrada.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/facturacion/')
        item = next(x for x in r.data['results'] if x['id'] == self.factura.id)
        for campo in ['id', 'fecha', 'condicion_vta', 'condicion_vta_display',
                      'nro_comprobante', 'nro_comprobante_formateado',
                      'cliente_nombre', 'cliente_documento',
                      'monto_total', 'is_anulado']:
            self.assertIn(campo, item)

    def test_list_busqueda_por_razon_social(self):
        persona2 = crear_persona('88700002', razon_social='Buscable VF Test')
        VentaFactCab.objects.create(
            fecha=HOY, condicion_vta=True, persona=persona2,
            timbrado=self.timbrado, nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        r = self.client.get('/api/facturacion/?search=Buscable VF')
        ids = [x['id'] for x in r.data['results']]
        self.assertTrue(len(ids) >= 1)

    def test_list_busqueda_por_nro_documento(self):
        persona3 = crear_persona('88700003', razon_social='Cliente Busqueda Doc')
        VentaFactCab.objects.create(
            fecha=HOY, persona=persona3, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        r = self.client.get('/api/facturacion/?search=88700003')
        ids = [x['id'] for x in r.data['results']]
        self.assertTrue(len(ids) >= 1)

    def test_list_filtro_condicion_vta_true(self):
        VentaFactCab.objects.create(
            fecha=HOY, condicion_vta=False, persona=self.persona,
            timbrado=self.timbrado, nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        r = self.client.get('/api/facturacion/?condicion_vta=true')
        for item in r.data['results']:
            self.assertTrue(item['condicion_vta'])

    def test_list_filtro_condicion_vta_false(self):
        VentaFactCab.objects.create(
            fecha=HOY, condicion_vta=False, persona=self.persona,
            timbrado=self.timbrado, nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        r = self.client.get('/api/facturacion/?condicion_vta=false')
        for item in r.data['results']:
            self.assertFalse(item['condicion_vta'])

    def test_list_filtro_fecha_desde(self):
        r = self.client.get(f'/api/facturacion/?fecha_desde={HOY}')
        for item in r.data['results']:
            self.assertGreaterEqual(item['fecha'], str(HOY))

    def test_list_filtro_fecha_hasta(self):
        r = self.client.get(f'/api/facturacion/?fecha_hasta={HOY}')
        for item in r.data['results']:
            self.assertLessEqual(item['fecha'], str(HOY))

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_factura(self):
        r = self.client.get(f'/api/facturacion/{self.factura.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['id'], self.factura.id)

    def test_retrieve_incluye_detalle_cobranza_cuotas(self):
        r = self.client.get(f'/api/facturacion/{self.factura.id}/')
        self.assertIn('detalle', r.data)
        self.assertIn('cobranza', r.data)
        self.assertIn('cuotas', r.data)

    def test_retrieve_eliminado_devuelve_404(self):
        fact = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        fact.soft_delete()
        r = self.client.get(f'/api/facturacion/{fact.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/facturacion/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create contado ────────────────────────────────────────────────────────

    def test_create_contado_valido(self):
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(r.data['condicion_vta'])

    def test_create_contado_crea_detalle_y_cobranza(self):
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(r.data['detalle']), 1)
        self.assertEqual(len(r.data['cobranza']), 1)

    def test_create_contado_crea_movimiento_caja(self):
        antes = MovimientoCajaBanco.objects.filter(is_deleted=False, cta=self.cta).count()
        self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertGreater(
            MovimientoCajaBanco.objects.filter(is_deleted=False, cta=self.cta).count(),
            antes,
        )

    def test_create_contado_calcula_totales(self):
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertGreater(Decimal(str(r.data['monto_total'])), 0)
        self.assertGreater(Decimal(str(r.data['grav_10'])), 0)
        self.assertGreater(Decimal(str(r.data['iva_10'])), 0)

    def test_create_contado_copia_establecimiento_expedicion(self):
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['establecimiento'], '001')
        self.assertEqual(r.data['expedicion'], '001')

    # ── Create crédito ────────────────────────────────────────────────────────

    def test_create_credito_valido(self):
        r = self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertFalse(r.data['condicion_vta'])

    def test_create_credito_crea_cuotas(self):
        r = self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        cuotas = CtaCobrar.objects.filter(vfc_id=r.data['id'], is_deleted=False)
        self.assertEqual(cuotas.count(), 3)

    def test_create_credito_no_crea_movimiento_caja(self):
        antes = MovimientoCajaBanco.objects.filter(is_deleted=False).count()
        self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        self.assertEqual(MovimientoCajaBanco.objects.filter(is_deleted=False).count(), antes)

    # ── Patch simple (sin detalle) ────────────────────────────────────────────

    def test_patch_simple_observacion(self):
        r = self.client.patch(f'/api/facturacion/{self.factura.id}/', {'observacion': 'Obs PATCH'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.factura.refresh_from_db()
        self.assertEqual(self.factura.observacion, 'Obs PATCH')

    def test_patch_simple_fecha(self):
        nueva_fecha = str(HOY - timedelta(days=1))
        r = self.client.patch(f'/api/facturacion/{self.factura.id}/', {'fecha': nueva_fecha})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.factura.refresh_from_db()
        self.assertEqual(str(self.factura.fecha), nueva_fecha)

    def test_patch_factura_anulada_retorna_400(self):
        self.factura.is_anulado = True
        self.factura.save(update_fields=['is_anulado'])
        r = self.client.patch(f'/api/facturacion/{self.factura.id}/', {'observacion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted(self):
        fact = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        r = self.client.delete(f'/api/facturacion/{fact.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        fact.refresh_from_db()
        self.assertTrue(fact.is_deleted)
        self.assertIsNotNone(fact.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        fact = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        self.client.delete(f'/api/facturacion/{fact.id}/')
        r = self.client.get('/api/facturacion/')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(fact.id, ids)

    def test_destroy_ya_borrado_retorna_404(self):
        fact = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        fact.soft_delete()
        r = self.client.delete(f'/api/facturacion/{fact.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_contado_borra_detalle_cobranza_y_movimientos(self):
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        fact_id = r.data['id']
        self.client.delete(f'/api/facturacion/{fact_id}/')
        self.assertFalse(VentaFactDet.objects.filter(vfc_id=fact_id, is_deleted=False).exists())
        self.assertFalse(VentaFactDetCobranza.objects.filter(vfc_id=fact_id, is_deleted=False).exists())

    def test_destroy_credito_sin_cobros_borra_cuotas(self):
        r = self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        fact_id = r.data['id']
        self.client.delete(f'/api/facturacion/{fact_id}/')
        self.assertFalse(CtaCobrar.objects.filter(vfc_id=fact_id, is_deleted=False).exists())


# ══════════════════════════════════════════════════════════════════════════════
# VALIDACIONES DE CREACIÓN
# ══════════════════════════════════════════════════════════════════════════════

class VentaFactValidacionesTest(BaseVentaFact):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_timbrado_inexistente_retorna_400(self):
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['timbrado'] = 99999
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_timbrado_no_vigente_retorna_400(self):
        vencido = crear_timbrado(
            nro_timbrado='19100002',
            inicio_vigencia=HOY - timedelta(days=60),
            fin_vigencia=HOY - timedelta(days=1),
        )
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['timbrado'] = vencido.id
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('timbrado', str(r.data).lower())

    def test_create_nro_fuera_de_rango_retorna_400(self):
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['nro_comprobante'] = 99999
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_nro_duplicado_retorna_400(self):
        nro = next_nro()
        VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=nro, monto_total=Decimal('0'),
        )
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta, nro=nro)
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('comprobante', str(r.data).lower())

    def test_create_nro_duplicado_borrado_logicamente_es_valido(self):
        nro = next_nro()
        fact_ant = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=nro, monto_total=Decimal('0'),
        )
        fact_ant.soft_delete()
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta, nro=nro)
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_producto_inactivo_retorna_400(self):
        prod_inactivo = crear_producto(self.grupo, descripcion='Prod Inactivo', activo=False)
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['detalle'] = [{'prs': prod_inactivo.id, 'cantidad': '1.00', 'monto': '110000.00'}]
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_producto_inexistente_retorna_400(self):
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['detalle'] = [{'prs': 99999, 'cantidad': '1.00', 'monto': '110000.00'}]
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_detalle_vacio_retorna_400(self):
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['detalle'] = []
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_contado_sin_cobranza_retorna_400(self):
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['cobranza'] = []
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_credito_sin_cuotas_retorna_400(self):
        p = payload_credito(self.timbrado, self.persona, self.producto)
        del p['cuotas']
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_persona_inexistente_retorna_400(self):
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        p['persona'] = 99999
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_fecha_retorna_400(self):
        p = payload_contado(self.timbrado, self.persona, self.producto, self.forma_pago, self.cta)
        del p['fecha']
        r = self.post_json('/api/facturacion/', p)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


# ══════════════════════════════════════════════════════════════════════════════
# ACCIONES PERSONALIZADAS
# ══════════════════════════════════════════════════════════════════════════════

class VentaFactAccionesTest(BaseVentaFact):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── Anular ────────────────────────────────────────────────────────────────

    def test_anular_sin_cobros_retorna_200(self):
        r = self.client.post(f'/api/facturacion/{self.factura.id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.factura.refresh_from_db()
        self.assertTrue(self.factura.is_anulado)

    def test_anular_ya_anulada_retorna_400(self):
        self.factura.is_anulado = True
        self.factura.save(update_fields=['is_anulado'])
        r = self.client.post(f'/api/facturacion/{self.factura.id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anular_factura_credito_sin_cobros(self):
        r_create = self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        fact_id = r_create.data['id']
        r = self.client.post(f'/api/facturacion/{fact_id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_anular_borra_cuotas_activas(self):
        r_create = self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        fact_id = r_create.data['id']
        self.client.post(f'/api/facturacion/{fact_id}/anular/')
        self.assertFalse(CtaCobrar.objects.filter(vfc_id=fact_id, is_deleted=False).exists())

    def test_anular_recep_puede_anular(self):
        self.client.force_authenticate(user=self.recep)
        r = self.client.post(f'/api/facturacion/{self.factura.id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_anular_medico_no_puede(self):
        self.client.force_authenticate(user=self.medico)
        r = self.client.post(f'/api/facturacion/{self.factura.id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    # ── Validar timbrado ──────────────────────────────────────────────────────

    def test_validar_timbrado_numero_valido(self):
        nro_libre = next_nro()
        r = self.client.post('/api/facturacion/validar-timbrado/', {
            'establecimiento': '001',
            'expedicion':      '001',
            'numero':          nro_libre,
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data['valido'])

    def test_validar_timbrado_numero_ya_usado(self):
        r = self.client.post('/api/facturacion/validar-timbrado/', {
            'establecimiento': '001',
            'expedicion':      '001',
            'numero':          self.factura.nro_comprobante,
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertFalse(r.data['valido'])

    def test_validar_timbrado_sin_timbrado_vigente(self):
        r = self.client.post('/api/facturacion/validar-timbrado/', {
            'establecimiento': '099',
            'expedicion':      '099',
            'numero':          1,
        })
        self.assertFalse(r.data['valido'])

    def test_validar_timbrado_datos_incompletos_retorna_400(self):
        r = self.client.post('/api/facturacion/validar-timbrado/', {
            'establecimiento': '001',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Siguiente número ──────────────────────────────────────────────────────

    def test_siguiente_numero_sin_facturas_retorna_nro_desde(self):
        tim = crear_timbrado(
            nro_timbrado='19100003',
            punto_sucursal='002',
            punto_expedicion='001',
            nro_desde=500,
            nro_hasta=999,
        )
        r = self.client.get('/api/facturacion/siguiente-numero/?establecimiento=002&expedicion=001')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['siguiente'], tim.nro_desde)

    def test_siguiente_numero_con_facturas_retorna_max_mas_uno(self):
        nro = next_nro()
        VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=nro, monto_total=Decimal('0'),
        )
        r = self.client.get('/api/facturacion/siguiente-numero/?establecimiento=001&expedicion=001')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        max_actual = VentaFactCab.objects.filter(
            timbrado=self.timbrado, is_deleted=False,
        ).aggregate(m=Max('nro_comprobante'))['m']
        self.assertEqual(r.data['siguiente'], max_actual + 1)

    def test_siguiente_numero_sin_punto_retorna_400(self):
        r = self.client.get('/api/facturacion/siguiente-numero/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_siguiente_numero_sin_timbrado_vigente_retorna_404(self):
        r = self.client.get('/api/facturacion/siguiente-numero/?establecimiento=099&expedicion=099')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Dashboard ─────────────────────────────────────────────────────────────

    def test_dashboard_mensual_retorna_estructura_esperada(self):
        r = self.client.get('/api/facturacion/dashboard-mensual/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for clave in ['mes_label', 'hoy', 'stats_hoy', 'totales_mes', 'por_dia', 'top_clientes']:
            self.assertIn(clave, r.data)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIONES — CobranzaDet bloquea destroy y anular
# ══════════════════════════════════════════════════════════════════════════════

class VentaFactConstraintTest(BaseVentaFact):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def _crear_factura_credito_con_cobro(self):
        r = self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        fact_id = r.data['id']
        cuota = CtaCobrar.objects.filter(vfc_id=fact_id, is_deleted=False).first()
        cobranza = Cobranza.objects.create(
            fecha=HOY,
            persona=self.persona,
            monto=cuota.monto_cuota,
            vuelto=Decimal('0'),
        )
        CobranzaDet.objects.create(
            cobranza=cobranza,
            cta_cobrar=cuota,
            monto_total=cuota.monto_total,
            monto_pagado=cuota.monto_cuota,
        )
        return fact_id

    def test_destroy_credito_con_cobros_retorna_400(self):
        fact_id = self._crear_factura_credito_con_cobro()
        r = self.client.delete(f'/api/facturacion/{fact_id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_destroy_credito_con_cobros_error_menciona_cobranza(self):
        fact_id = self._crear_factura_credito_con_cobro()
        r = self.client.delete(f'/api/facturacion/{fact_id}/')
        self.assertIn('cobr', str(r.data).lower())

    def test_destroy_credito_con_cobros_no_borra(self):
        fact_id = self._crear_factura_credito_con_cobro()
        self.client.delete(f'/api/facturacion/{fact_id}/')
        fact = VentaFactCab.objects.get(pk=fact_id)
        self.assertFalse(fact.is_deleted)

    def test_destroy_credito_sin_cobros_puede_eliminarse(self):
        r = self.post_json('/api/facturacion/', payload_credito(
            self.timbrado, self.persona, self.producto,
        ))
        fact_id = r.data['id']
        r_del = self.client.delete(f'/api/facturacion/{fact_id}/')
        self.assertEqual(r_del.status_code, status.HTTP_204_NO_CONTENT)

    def test_destroy_contado_puede_eliminarse_sin_restriccion(self):
        r = self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        fact_id = r.data['id']
        r_del = self.client.delete(f'/api/facturacion/{fact_id}/')
        self.assertEqual(r_del.status_code, status.HTTP_204_NO_CONTENT)

    def test_anular_con_cobros_retorna_400(self):
        fact_id = self._crear_factura_credito_con_cobro()
        r = self.client.post(f'/api/facturacion/{fact_id}/anular/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anular_con_cobros_error_menciona_cobranza(self):
        fact_id = self._crear_factura_credito_con_cobro()
        r = self.client.post(f'/api/facturacion/{fact_id}/anular/')
        self.assertIn('cobr', str(r.data).lower())


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class VentaFactAuditoriaTest(BaseVentaFact):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'VentaFactCab')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        self.client.patch(f'/api/facturacion/{self.factura.id}/', {'observacion': 'Audit Obs'})
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'VentaFactCab')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_destroy_registra_auditoria(self):
        fact = VentaFactCab.objects.create(
            fecha=HOY, persona=self.persona, timbrado=self.timbrado,
            nro_comprobante=next_nro(), monto_total=Decimal('0'),
        )
        antes = RegistroAuditoria.objects.count()
        self.client.delete(f'/api/facturacion/{fact.id}/')
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'VentaFactCab')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        self.post_json('/api/facturacion/', payload_contado(
            self.timbrado, self.persona, self.producto, self.forma_pago, self.cta,
        ))
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_datos_antes_y_despues_no_nulos(self):
        self.client.patch(f'/api/facturacion/{self.factura.id}/', {'observacion': 'Audit Datos'})
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
