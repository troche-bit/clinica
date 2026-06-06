from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.persona.models import Persona, TipoDocumento
from apps.administracion.users.models import PerfilUsuario
from apps.finanzas.caja_banco.models import CuentaMcb, MovimientoCajaBanco

User = get_user_model()
HOY = date.today()

_NRO_DOC_ITER = iter(range(80000001, 89999999))


def next_doc():
    return str(next(_NRO_DOC_ITER))


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_cuenta(desc='Caja Principal'):
    return CuentaMcb.objects.create(descripcion=desc)


def crear_movimiento(cta, ingreso=None, egreso=None, nro=None):
    return MovimientoCajaBanco.objects.create(
        cta=cta,
        fecha=HOY,
        nro_comprobante=nro,
        monto_ingreso=Decimal(ingreso or '0'),
        monto_egreso=Decimal(egreso or '0'),
    )


# ─────────────────────────────────────────────────────────────────────────────
class BaseCajaBanco(APITestCase):

    @classmethod
    def setUpTestData(cls):
        cls.admin = crear_usuario('admin_cb', 'admin')
        cls.recep = crear_usuario('recep_cb', 'recepcionista')
        cls.medico = crear_usuario('medico_cb', 'medico')

        cls.cuenta = crear_cuenta('Caja Base')
        cls.movimiento = crear_movimiento(cls.cuenta, ingreso='50000')

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ─────────────────────────────────────────────────────────────────────────────
class PermisosCajaBancoTest(BaseCajaBanco):

    # ── CuentaMcb ────────────────────────────────────────────────────────────

    def test_cuenta_anonimo_list_401(self):
        r = self.client.get('/api/cuentas-mcb/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cuenta_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/cuentas-mcb/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_cuenta_recep_no_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'Recep cuenta'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_cuenta_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'Medico cuenta'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_cuenta_recep_no_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/cuentas-mcb/{self.cuenta.id}/', {'descripcion': 'x'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_cuenta_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/cuentas-mcb/{self.cuenta.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_cuenta_recep_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/cuentas-mcb/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_cuenta_admin_puede_crear(self):
        self.auth(self.admin)
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'Admin cuenta perm'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_cuenta_medico_puede_ver_dashboard(self):
        self.auth(self.medico)
        r = self.client.get('/api/cuentas-mcb/dashboard-mensual/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # ── MovimientoCajaBanco ───────────────────────────────────────────────────

    def test_movimiento_anonimo_list_401(self):
        r = self.client.get('/api/movimientos-caja/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_movimiento_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/movimientos-caja/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_movimiento_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id, 'fecha': HOY.isoformat(),
            'monto_ingreso': '10000', 'monto_egreso': '0',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_movimiento_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id, 'fecha': HOY.isoformat(),
            'monto_ingreso': '20000', 'monto_egreso': '0',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_movimiento_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/movimientos-caja/{self.movimiento.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_movimiento_admin_puede_eliminar(self):
        mov = crear_movimiento(self.cuenta, ingreso='5000')
        self.auth(self.admin)
        r = self.client.delete(f'/api/movimientos-caja/{mov.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_movimiento_medico_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/movimientos-caja/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ─────────────────────────────────────────────────────────────────────────────
class CuentaMcbCrudTest(BaseCajaBanco):

    def setUp(self):
        self.auth(self.admin)

    # ── list ─────────────────────────────────────────────────────────────────

    def test_list_solo_activos(self):
        eliminada = crear_cuenta('Cuenta Eliminada CB')
        eliminada.is_deleted = True
        eliminada.save()
        r = self.client.get('/api/cuentas-mcb/')
        ids = [c['id'] for c in r.data['results']]
        self.assertIn(self.cuenta.id, ids)
        self.assertNotIn(eliminada.id, ids)

    def test_list_contiene_saldo_y_total_movimientos(self):
        r = self.client.get('/api/cuentas-mcb/')
        cuenta_data = next(
            (c for c in r.data['results'] if c['id'] == self.cuenta.id), None
        )
        self.assertIsNotNone(cuenta_data)
        self.assertIn('saldo', cuenta_data)
        self.assertIn('total_movimientos', cuenta_data)
        self.assertGreaterEqual(int(cuenta_data['total_movimientos']), 1)

    def test_list_busqueda(self):
        crear_cuenta('Cuenta Banco Fantasma')
        r = self.client.get('/api/cuentas-mcb/?search=Banco')
        descripciones = [c['descripcion'] for c in r.data['results']]
        self.assertTrue(any('Banco' in d for d in descripciones))

    def test_retrieve_campos(self):
        r = self.client.get(f'/api/cuentas-mcb/{self.cuenta.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertIn('descripcion', r.data)
        self.assertIn('saldo', r.data)
        self.assertIn('total_movimientos', r.data)

    # ── create ───────────────────────────────────────────────────────────────

    def test_create_valido(self):
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'Banco Nacional'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Banco Nacional')

    def test_create_trim_descripcion(self):
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': '  Caja Chica  '})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Caja Chica')

    def test_create_duplicado_exacto_400(self):
        crear_cuenta('Cuenta Duplicada CB')
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'Cuenta Duplicada CB'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_case_insensitive_400(self):
        crear_cuenta('Caja Efectivo CB')
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'caja efectivo cb'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_mayusculas_400(self):
        crear_cuenta('Cuenta Corriente CB')
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'CUENTA CORRIENTE CB'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_descripcion_vacia_400(self):
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': ''})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_reutilizable_tras_borrado(self):
        c = crear_cuenta('Cuenta Temporal CB')
        c.is_deleted = True
        c.save()
        r = self.client.post('/api/cuentas-mcb/', {'descripcion': 'Cuenta Temporal CB'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── patch ─────────────────────────────────────────────────────────────────

    def test_patch_descripcion(self):
        c = crear_cuenta('Cuenta A Editar CB')
        r = self.client.patch(f'/api/cuentas-mcb/{c.id}/', {'descripcion': 'Cuenta Editada CB'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        c.refresh_from_db()
        self.assertEqual(c.descripcion, 'Cuenta Editada CB')

    def test_patch_mismo_valor_no_falla(self):
        c = crear_cuenta('Cuenta Sin Cambio CB')
        r = self.client.patch(f'/api/cuentas-mcb/{c.id}/', {'descripcion': 'Cuenta Sin Cambio CB'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_duplicado_de_otro_400(self):
        crear_cuenta('Cuenta Ocupada CB')
        c2 = crear_cuenta('Cuenta Libre CB')
        r = self.client.patch(f'/api/cuentas-mcb/{c2.id}/', {'descripcion': 'Cuenta Ocupada CB'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted(self):
        c = crear_cuenta('Cuenta A Borrar CB')
        r = self.client.delete(f'/api/cuentas-mcb/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        c.refresh_from_db()
        self.assertTrue(c.is_deleted)
        self.assertIsNotNone(c.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        c = crear_cuenta('Cuenta Invisible CB')
        self.client.delete(f'/api/cuentas-mcb/{c.id}/')
        r = self.client.get('/api/cuentas-mcb/')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(c.id, ids)

    def test_destroy_ya_borrado_404(self):
        c = crear_cuenta('Cuenta Ya Borrada CB')
        c.is_deleted = True
        c.save()
        r = self.client.delete(f'/api/cuentas-mcb/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_destroy_con_movimientos_activos_bloquea(self):
        c = crear_cuenta('Cuenta Con Movs CB')
        crear_movimiento(c, ingreso='10000')
        r = self.client.delete(f'/api/cuentas-mcb/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        c.refresh_from_db()
        self.assertFalse(c.is_deleted)

    def test_destroy_con_movimiento_borrado_permite(self):
        c = crear_cuenta('Cuenta Movs Borrados CB')
        mov = crear_movimiento(c, ingreso='10000')
        mov.is_deleted = True
        mov.save()
        r = self.client.delete(f'/api/cuentas-mcb/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    # ── eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_borrados(self):
        c = crear_cuenta('Cuenta Solo Eliminados CB')
        c.is_deleted = True
        c.save()
        r = self.client.get('/api/cuentas-mcb/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x['id'] for x in r.data]
        self.assertIn(c.id, ids)

    def test_eliminados_no_incluye_activos(self):
        c_activa = crear_cuenta('Cuenta Activa No Eliminados CB')
        r = self.client.get('/api/cuentas-mcb/eliminados/')
        ids = [x['id'] for x in r.data]
        self.assertNotIn(c_activa.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/cuentas-mcb/eliminados/')
        self.assertIsInstance(r.data, list)

    # ── dashboard_mensual ────────────────────────────────────────────────────

    def test_dashboard_mensual_estructura(self):
        r = self.client.get('/api/cuentas-mcb/dashboard-mensual/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        for clave in ('total_ingresos_mes', 'total_egresos_mes', 'saldo_neto_mes',
                      'cuentas', 'por_dia', 'mes', 'fecha'):
            self.assertIn(clave, r.data)

    def test_dashboard_mensual_cuentas_es_lista(self):
        r = self.client.get('/api/cuentas-mcb/dashboard-mensual/')
        self.assertIsInstance(r.data['cuentas'], list)

    def test_dashboard_mensual_por_dia_es_lista(self):
        r = self.client.get('/api/cuentas-mcb/dashboard-mensual/')
        self.assertIsInstance(r.data['por_dia'], list)
        if r.data['por_dia']:
            primer_dia = r.data['por_dia'][0]
            self.assertIn('fecha', primer_dia)
            self.assertIn('ingresos', primer_dia)
            self.assertIn('egresos', primer_dia)


# ─────────────────────────────────────────────────────────────────────────────
class MovimientoCrudTest(BaseCajaBanco):

    def setUp(self):
        self.auth(self.admin)

    # ── list ─────────────────────────────────────────────────────────────────

    def test_list_solo_activos(self):
        mov_del = crear_movimiento(self.cuenta, ingreso='1000')
        mov_del.is_deleted = True
        mov_del.save()
        r = self.client.get('/api/movimientos-caja/')
        ids = [m['id'] for m in r.data['results']]
        self.assertIn(self.movimiento.id, ids)
        self.assertNotIn(mov_del.id, ids)

    def test_list_contiene_campos_requeridos(self):
        r = self.client.get('/api/movimientos-caja/')
        if r.data['results']:
            mov = r.data['results'][0]
            for campo in ('id', 'cta', 'cta_detalle', 'fecha',
                          'monto_ingreso', 'monto_egreso', 'tipo'):
                self.assertIn(campo, mov)

    def test_list_campo_tipo_ingreso(self):
        r = self.client.get('/api/movimientos-caja/')
        mov = next(
            (m for m in r.data['results'] if m['id'] == self.movimiento.id), None
        )
        self.assertIsNotNone(mov)
        self.assertEqual(mov['tipo'], 'ingreso')

    # ── filtros ───────────────────────────────────────────────────────────────

    def test_filtro_por_cta(self):
        otra = crear_cuenta('Cuenta Secundaria CB Mov')
        mov_otra = crear_movimiento(otra, egreso='9000')
        r = self.client.get(f'/api/movimientos-caja/?cta={otra.id}')
        ids = [m['id'] for m in r.data['results']]
        self.assertIn(mov_otra.id, ids)
        self.assertNotIn(self.movimiento.id, ids)

    def test_filtro_tipo_ingreso(self):
        c = crear_cuenta('Cuenta Filtro Tipo CB')
        mov_ing = crear_movimiento(c, ingreso='7000')
        mov_egr = crear_movimiento(c, egreso='3000')
        r = self.client.get(f'/api/movimientos-caja/?tipo=ingreso&cta={c.id}')
        ids = [m['id'] for m in r.data['results']]
        self.assertIn(mov_ing.id, ids)
        self.assertNotIn(mov_egr.id, ids)

    def test_filtro_tipo_egreso(self):
        c = crear_cuenta('Cuenta Filtro Egreso CB')
        mov_ing = crear_movimiento(c, ingreso='7000')
        mov_egr = crear_movimiento(c, egreso='3000')
        r = self.client.get(f'/api/movimientos-caja/?tipo=egreso&cta={c.id}')
        ids = [m['id'] for m in r.data['results']]
        self.assertIn(mov_egr.id, ids)
        self.assertNotIn(mov_ing.id, ids)

    def test_filtro_fecha_desde(self):
        c = crear_cuenta('Cuenta Fecha Desde CB')
        mov_hoy  = crear_movimiento(c, ingreso='1000')
        mov_viejo = MovimientoCajaBanco.objects.create(
            cta=c, fecha=HOY - timedelta(days=10),
            monto_ingreso=Decimal('2000'), monto_egreso=Decimal('0'),
        )
        desde = HOY.isoformat()
        r = self.client.get(f'/api/movimientos-caja/?fecha_desde={desde}&cta={c.id}')
        ids = [m['id'] for m in r.data['results']]
        self.assertIn(mov_hoy.id, ids)
        self.assertNotIn(mov_viejo.id, ids)

    def test_filtro_fecha_hasta(self):
        c = crear_cuenta('Cuenta Fecha Hasta CB')
        mov_hoy    = crear_movimiento(c, ingreso='1000')
        mov_futuro = MovimientoCajaBanco.objects.create(
            cta=c, fecha=HOY + timedelta(days=5),
            monto_ingreso=Decimal('500'), monto_egreso=Decimal('0'),
        )
        hasta = (HOY - timedelta(days=1)).isoformat()
        r = self.client.get(f'/api/movimientos-caja/?fecha_hasta={hasta}&cta={c.id}')
        ids = [m['id'] for m in r.data['results']]
        self.assertNotIn(mov_hoy.id, ids)
        self.assertNotIn(mov_futuro.id, ids)

    def test_filtro_busqueda_nro_comprobante(self):
        c = crear_cuenta('Cuenta Busqueda NRO CB')
        mov = crear_movimiento(c, ingreso='4000', nro='COMP-TEST-999')
        r = self.client.get('/api/movimientos-caja/?search=COMP-TEST-999')
        ids = [m['id'] for m in r.data['results']]
        self.assertIn(mov.id, ids)

    # ── create ───────────────────────────────────────────────────────────────

    def test_create_ingreso_valido(self):
        r = self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id,
            'fecha': HOY.isoformat(),
            'monto_ingreso': '30000',
            'monto_egreso': '0',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.data['monto_ingreso']), Decimal('30000'))

    def test_create_egreso_valido(self):
        r = self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id,
            'fecha': HOY.isoformat(),
            'monto_ingreso': '0',
            'monto_egreso': '15000',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Decimal(r.data['monto_egreso']), Decimal('15000'))

    def test_create_con_nro_comprobante(self):
        r = self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id,
            'fecha': HOY.isoformat(),
            'nro_comprobante': 'REC-001-2026',
            'monto_ingreso': '8000',
            'monto_egreso': '0',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_sin_monto_400(self):
        r = self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id,
            'fecha': HOY.isoformat(),
            'monto_ingreso': '0',
            'monto_egreso': '0',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_ambos_montos_400(self):
        r = self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id,
            'fecha': HOY.isoformat(),
            'monto_ingreso': '5000',
            'monto_egreso': '3000',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_cuenta_inexistente_400(self):
        r = self.client.post('/api/movimientos-caja/', {
            'cta': 99999,
            'fecha': HOY.isoformat(),
            'monto_ingreso': '5000',
            'monto_egreso': '0',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── patch ─────────────────────────────────────────────────────────────────

    def test_patch_nro_comprobante(self):
        c = crear_cuenta('Cuenta Patch Mov CB')
        mov = crear_movimiento(c, ingreso='6000')
        r = self.client.patch(f'/api/movimientos-caja/{mov.id}/', {
            'nro_comprobante': 'REC-EDITADO',
            'monto_ingreso': '6000',
            'monto_egreso': '0',
        })
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        mov.refresh_from_db()
        self.assertEqual(mov.nro_comprobante, 'REC-EDITADO')

    def test_patch_auto_generado_vrc_400(self):
        c = crear_cuenta('Cuenta Auto Gen Vrc CB')
        mov = MovimientoCajaBanco.objects.create(
            cta=c, fecha=HOY,
            monto_ingreso=Decimal('10000'), monto_egreso=Decimal('0'),
            vrc_id=42,
        )
        r = self.client.patch(f'/api/movimientos-caja/{mov.id}/', {
            'nro_comprobante': 'NO DEBE EDITARSE',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_auto_generado_vfdc_400(self):
        c = crear_cuenta('Cuenta Auto Gen Vfdc CB')
        mov = MovimientoCajaBanco.objects.create(
            cta=c, fecha=HOY,
            monto_ingreso=Decimal('10000'), monto_egreso=Decimal('0'),
            vfdc_id=99,
        )
        r = self.client.patch(f'/api/movimientos-caja/{mov.id}/', {
            'nro_comprobante': 'NO DEBE EDITARSE',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_auto_generado_ppdc_400(self):
        c = crear_cuenta('Cuenta Auto Gen Ppdc CB')
        mov = MovimientoCajaBanco.objects.create(
            cta=c, fecha=HOY,
            monto_egreso=Decimal('10000'), monto_ingreso=Decimal('0'),
            ppdc_id=55,
        )
        r = self.client.patch(f'/api/movimientos-caja/{mov.id}/', {
            'nro_comprobante': 'NO DEBE EDITARSE',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── destroy ───────────────────────────────────────────────────────────────

    def test_destroy_manual_204(self):
        c = crear_cuenta('Cuenta Destroy Manual CB')
        mov = crear_movimiento(c, ingreso='11000')
        r = self.client.delete(f'/api/movimientos-caja/{mov.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        mov.refresh_from_db()
        self.assertTrue(mov.is_deleted)
        self.assertIsNotNone(mov.fecha_eliminacion)

    def test_destroy_manual_no_aparece_en_list(self):
        c = crear_cuenta('Cuenta Destroy Invisible CB')
        mov = crear_movimiento(c, ingreso='9000')
        self.client.delete(f'/api/movimientos-caja/{mov.id}/')
        r = self.client.get('/api/movimientos-caja/')
        ids = [m['id'] for m in r.data['results']]
        self.assertNotIn(mov.id, ids)

    def test_destroy_auto_generado_vrc_bloquea(self):
        c = crear_cuenta('Cuenta Destroy Auto CB')
        mov = MovimientoCajaBanco.objects.create(
            cta=c, fecha=HOY,
            monto_ingreso=Decimal('10000'), monto_egreso=Decimal('0'),
            vrc_id=77,
        )
        r = self.client.delete(f'/api/movimientos-caja/{mov.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        mov.refresh_from_db()
        self.assertFalse(mov.is_deleted)

    def test_destroy_ya_borrado_404(self):
        c = crear_cuenta('Cuenta Ya Borrada Mov CB')
        mov = crear_movimiento(c, ingreso='2000')
        mov.is_deleted = True
        mov.save()
        r = self.client.delete(f'/api/movimientos-caja/{mov.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_borrados(self):
        c = crear_cuenta('Cuenta Eliminados Mov CB')
        mov = crear_movimiento(c, egreso='4000')
        mov.is_deleted = True
        mov.save()
        r = self.client.get('/api/movimientos-caja/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [m['id'] for m in r.data]
        self.assertIn(mov.id, ids)

    def test_eliminados_no_incluye_activos(self):
        c = crear_cuenta('Cuenta Activos No Eli CB')
        mov_activo = crear_movimiento(c, ingreso='3000')
        r = self.client.get('/api/movimientos-caja/eliminados/')
        ids = [m['id'] for m in r.data]
        self.assertNotIn(mov_activo.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/movimientos-caja/eliminados/')
        self.assertIsInstance(r.data, list)

    # ── saldo_anotado en cuenta ───────────────────────────────────────────────

    def test_saldo_cuenta_refleja_movimientos(self):
        c = crear_cuenta('Cuenta Saldo Anotado CB')
        crear_movimiento(c, ingreso='100000')
        crear_movimiento(c, egreso='30000')
        r = self.client.get(f'/api/cuentas-mcb/{c.id}/')
        saldo = Decimal(str(r.data['saldo']))
        self.assertEqual(saldo, Decimal('70000'))

    def test_saldo_excluye_movimientos_borrados(self):
        c = crear_cuenta('Cuenta Saldo Borrados CB')
        crear_movimiento(c, ingreso='50000')
        mov_del = crear_movimiento(c, egreso='50000')
        mov_del.is_deleted = True
        mov_del.save()
        r = self.client.get(f'/api/cuentas-mcb/{c.id}/')
        saldo = Decimal(str(r.data['saldo']))
        self.assertEqual(saldo, Decimal('50000'))

    # ── tipo property ─────────────────────────────────────────────────────────

    def test_tipo_ingreso(self):
        mov = crear_movimiento(self.cuenta, ingreso='1000')
        self.assertEqual(mov.tipo, 'ingreso')

    def test_tipo_egreso(self):
        mov = crear_movimiento(self.cuenta, egreso='1000')
        self.assertEqual(mov.tipo, 'egreso')

    def test_tipo_sin_movimiento(self):
        mov = MovimientoCajaBanco.objects.create(
            cta=self.cuenta, fecha=HOY,
            monto_ingreso=Decimal('0'), monto_egreso=Decimal('0'),
        )
        self.assertEqual(mov.tipo, 'sin_movimiento')


# ─────────────────────────────────────────────────────────────────────────────
class CajaBancoAuditoriaTest(BaseCajaBanco):

    def setUp(self):
        self.auth(self.admin)

    def test_crear_cuenta_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        self.client.post('/api/cuentas-mcb/', {'descripcion': 'Cuenta Auditoria Crear CB'})
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.accion, 'CREAR')
        self.assertEqual(reg.tabla, 'CuentaMcb')
        self.assertEqual(reg.usuario, self.admin)
        self.assertIsNotNone(reg.datos_despues)

    def test_editar_cuenta_registra_auditoria(self):
        c = crear_cuenta('Cuenta Auditoria Editar CB')
        antes = RegistroAuditoria.objects.count()
        self.client.patch(f'/api/cuentas-mcb/{c.id}/', {'descripcion': 'Cuenta Auditoria Editada CB'})
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.accion, 'EDITAR')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)

    def test_eliminar_cuenta_registra_auditoria(self):
        c = crear_cuenta('Cuenta Auditoria Eliminar CB')
        antes = RegistroAuditoria.objects.count()
        self.client.delete(f'/api/cuentas-mcb/{c.id}/')
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.accion, 'ELIMINAR')
        self.assertIsNotNone(reg.datos_antes)

    def test_crear_movimiento_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        self.client.post('/api/movimientos-caja/', {
            'cta': self.cuenta.id,
            'fecha': HOY.isoformat(),
            'monto_ingreso': '25000',
            'monto_egreso': '0',
        })
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.accion, 'CREAR')
        self.assertEqual(reg.tabla, 'MovimientoCajaBanco')
        self.assertEqual(reg.usuario, self.admin)

    def test_editar_movimiento_registra_auditoria(self):
        c = crear_cuenta('Cuenta Auditoria Edit Mov CB')
        mov = crear_movimiento(c, ingreso='5000')
        antes = RegistroAuditoria.objects.count()
        self.client.patch(f'/api/movimientos-caja/{mov.id}/', {
            'nro_comprobante': 'REC-AUD-001',
            'monto_ingreso': '5000',
            'monto_egreso': '0',
        })
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.accion, 'EDITAR')
        self.assertIsNotNone(reg.datos_antes)

    def test_eliminar_movimiento_registra_auditoria(self):
        c = crear_cuenta('Cuenta Auditoria Eli Mov CB')
        mov = crear_movimiento(c, egreso='7000')
        antes = RegistroAuditoria.objects.count()
        self.client.delete(f'/api/movimientos-caja/{mov.id}/')
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.accion, 'ELIMINAR')
        self.assertEqual(reg.tabla, 'MovimientoCajaBanco')
        self.assertIsNotNone(reg.datos_antes)
