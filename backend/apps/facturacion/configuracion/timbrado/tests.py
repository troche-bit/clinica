from datetime import date, timedelta
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.facturacion.configuracion.timbrado.models import Timbrado
from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()

HOY   = date.today()
INICIO = HOY - timedelta(days=30)
FIN    = HOY + timedelta(days=30)

PAYLOAD_BASE = {
    'nro_timbrado':    '12345678',
    'inicio_vigencia': str(INICIO),
    'fin_vigencia':    str(FIN),
    'punto_sucursal':  '001',
    'punto_expedicion':'001',
    'nro_desde':       1,
    'nro_hasta':       1000,
    'autoimpresor':    False,
}


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_timbrado(**kwargs):
    data = {**PAYLOAD_BASE, **kwargs}
    return Timbrado.objects.create(**data)


class BaseTimbrado(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('tim_admin',  'admin')
        self.recep  = crear_usuario('tim_recep',  'recepcionista')
        self.medico = crear_usuario('tim_medico', 'medico')
        self.tim    = crear_timbrado()

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosTimbradoTest(BaseTimbrado):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/timbrado/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/timbrado/', PAYLOAD_BASE)
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/timbrado/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/timbrado/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/timbrado/{self.tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '11111111'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_timbrado': '22222222'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/timbrado/{self.tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/timbrado/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/timbrado/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_crear(self):
        self.auth(self.recep)
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '33333333'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_timbrado': '44444444'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/timbrado/{self.tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/timbrado/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '55555555'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_editar(self):
        self.auth(self.admin)
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_habilitacion': 'HAB-001'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        tim = crear_timbrado(nro_timbrado='66666666')
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/timbrado/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD
# ══════════════════════════════════════════════════════════════════════════════

class TimbradoCrudTest(BaseTimbrado):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrado = crear_timbrado(nro_timbrado='99999999')
        borrado.soft_delete()
        r = self.client.get('/api/timbrado/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.tim.id, ids)
        self.assertNotIn(borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/timbrado/')
        item = next(x for x in r.data['results'] if x['id'] == self.tim.id)
        for campo in ['id', 'nro_timbrado', 'autoimpresor', 'tipo', 'inicio_vigencia',
                      'fin_vigencia', 'punto_sucursal', 'punto_expedicion',
                      'nro_desde', 'nro_hasta', 'nro_habilitacion',
                      'vigente', 'dias_restantes', 'total_comprobantes']:
            self.assertIn(campo, item)

    def test_list_busqueda_por_nro_timbrado(self):
        crear_timbrado(nro_timbrado='77700001')
        r = self.client.get('/api/timbrado/?search=77700001')
        ids = [x['id'] for x in r.data['results']]
        self.assertTrue(all('77700001' in x['nro_timbrado'] for x in r.data['results']))

    def test_list_busqueda_por_nro_habilitacion(self):
        crear_timbrado(
            nro_timbrado='77700002',
            autoimpresor=True,
            nro_habilitacion='HAB-BUSCABLE',
        )
        r = self.client.get('/api/timbrado/?search=HAB-BUSCABLE')
        self.assertTrue(len(r.data['results']) >= 1)

    def test_list_filtro_vigente_true(self):
        # self.tim es vigente (inicio <= hoy <= fin)
        vencido = crear_timbrado(
            nro_timbrado='88800001',
            inicio_vigencia=str(HOY - timedelta(days=60)),
            fin_vigencia=str(HOY - timedelta(days=1)),
        )
        r = self.client.get('/api/timbrado/?vigente=true')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.tim.id, ids)
        self.assertNotIn(vencido.id, ids)

    def test_list_filtro_vigente_false(self):
        vencido = crear_timbrado(
            nro_timbrado='88800002',
            inicio_vigencia=str(HOY - timedelta(days=60)),
            fin_vigencia=str(HOY - timedelta(days=1)),
        )
        r = self.client.get('/api/timbrado/?vigente=false')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(vencido.id, ids)
        self.assertNotIn(self.tim.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_timbrado(self):
        r = self.client.get(f'/api/timbrado/{self.tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['nro_timbrado'], '12345678')

    def test_retrieve_eliminado_devuelve_404(self):
        borrado = crear_timbrado(nro_timbrado='88800003')
        borrado.soft_delete()
        r = self.client.get(f'/api/timbrado/{borrado.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/timbrado/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_campo_vigente_calculado(self):
        r = self.client.get(f'/api/timbrado/{self.tim.id}/')
        self.assertTrue(r.data['vigente'])

    def test_retrieve_campo_total_comprobantes(self):
        r = self.client.get(f'/api/timbrado/{self.tim.id}/')
        # nro_hasta(1000) - nro_desde(1) + 1 = 1000
        self.assertEqual(r.data['total_comprobantes'], 1000)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '10000001'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_timbrado'], '10000001')

    def test_create_strip_espacios_nro_timbrado(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '  10000002  '}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['nro_timbrado'], '10000002')

    def test_create_autoimpresor_sin_habilitacion_retorna_400(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '10000003', 'autoimpresor': True, 'nro_habilitacion': ''}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nro_habilitacion', str(r.data))

    def test_create_autoimpresor_con_habilitacion_valido(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '10000004', 'autoimpresor': True, 'nro_habilitacion': 'HAB-001'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_nro_timbrado_con_letras_retorna_400(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': 'ABC12345'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nro_timbrado', str(r.data))

    def test_create_punto_sucursal_no_tres_digitos_retorna_400(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '10000005', 'punto_sucursal': '01'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_punto_expedicion_con_letras_retorna_400(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '10000006', 'punto_expedicion': 'ABC'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_fin_igual_inicio_retorna_400(self):
        payload = {
            **PAYLOAD_BASE,
            'nro_timbrado': '10000007',
            'inicio_vigencia': str(HOY),
            'fin_vigencia':    str(HOY),
        }
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('fin_vigencia', str(r.data))

    def test_create_fin_anterior_a_inicio_retorna_400(self):
        payload = {
            **PAYLOAD_BASE,
            'nro_timbrado': '10000008',
            'inicio_vigencia': str(HOY),
            'fin_vigencia':    str(HOY - timedelta(days=1)),
        }
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_nro_hasta_igual_desde_retorna_400(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '10000009', 'nro_desde': 100, 'nro_hasta': 100}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nro_hasta', str(r.data))

    def test_create_nro_hasta_menor_que_desde_retorna_400(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '10000010', 'nro_desde': 500, 'nro_hasta': 100}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_combinacion_completa_retorna_400(self):
        # mismo nro + fechas + puntos + rango = duplicado
        r = self.client.post('/api/timbrado/', PAYLOAD_BASE)
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_mismo_nro_diferente_punto_valido(self):
        payload = {**PAYLOAD_BASE, 'punto_sucursal': '002'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_reutilizable_tras_borrado_logico(self):
        tim = crear_timbrado(nro_timbrado='10000011')
        tim.soft_delete()
        r = self.client.post('/api/timbrado/', {**PAYLOAD_BASE, 'nro_timbrado': '10000011'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_nro_habilitacion(self):
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_habilitacion': 'HAB-PATCH'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.tim.refresh_from_db()
        self.assertEqual(self.tim.nro_habilitacion, 'HAB-PATCH')

    def test_patch_nro_timbrado(self):
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_timbrado': '87654321'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.tim.refresh_from_db()
        self.assertEqual(self.tim.nro_timbrado, '87654321')

    def test_patch_mismo_valor_no_falla(self):
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_timbrado': '12345678'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_fin_anterior_a_inicio_retorna_400(self):
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {
            'fin_vigencia': str(INICIO - timedelta(days=1)),
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_nro_hasta_menor_que_desde_retorna_400(self):
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_hasta': 0})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_autoimpresor_true_sin_habilitacion_retorna_400(self):
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'autoimpresor': True})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nro_habilitacion', str(r.data))

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted(self):
        tim = crear_timbrado(nro_timbrado='20000001')
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        tim.refresh_from_db()
        self.assertTrue(tim.is_deleted)
        self.assertIsNotNone(tim.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        tim = crear_timbrado(nro_timbrado='20000002')
        self.client.delete(f'/api/timbrado/{tim.id}/')
        r = self.client.get('/api/timbrado/')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(tim.id, ids)

    def test_destroy_ya_borrado_retorna_404(self):
        tim = crear_timbrado(nro_timbrado='20000003')
        tim.soft_delete()
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        tim = crear_timbrado(nro_timbrado='20000004')
        tim.soft_delete()
        r = self.client.get('/api/timbrado/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(tim.id, ids)
        self.assertNotIn(self.tim.id, ids)

    def test_eliminados_paginado(self):
        r = self.client.get('/api/timbrado/eliminados/')
        self.assertIn('results', r.data)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Facturas activas bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class TimbradoConstraintTest(BaseTimbrado):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        from apps.facturacion.ventas.models import VentaFactCab
        from apps.administracion.persona.models import TipoDocumento, Persona
        self.VentaFactCab = VentaFactCab

        tipo_doc = TipoDocumento.objects.create(descripcion='CI-TIM')
        self.persona = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='99900001',
            razon_social='Cliente Test Timbrado',
        )

    def _crear_factura(self, timbrado, is_deleted=False):
        f = self.VentaFactCab.objects.create(
            fecha=HOY,
            persona=self.persona,
            timbrado=timbrado,
            nro_comprobante=9990001,
        )
        if is_deleted:
            f.soft_delete()
        return f

    def test_timbrado_con_factura_activa_no_puede_eliminarse(self):
        tim = crear_timbrado(nro_timbrado='30000001')
        self._crear_factura(tim)
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        tim.refresh_from_db()
        self.assertFalse(tim.is_deleted)

    def test_error_menciona_facturas(self):
        tim = crear_timbrado(nro_timbrado='30000002')
        self._crear_factura(tim)
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertIn('factura', str(r.data).lower())

    def test_timbrado_con_solo_factura_borrada_puede_eliminarse(self):
        tim = crear_timbrado(nro_timbrado='30000003')
        self._crear_factura(tim, is_deleted=True)
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        tim.refresh_from_db()
        self.assertTrue(tim.is_deleted)

    def test_timbrado_sin_facturas_puede_eliminarse(self):
        tim = crear_timbrado(nro_timbrado='30000004')
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA
# ══════════════════════════════════════════════════════════════════════════════

class TimbradoAuditoriaTest(BaseTimbrado):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '40000001'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Timbrado')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_habilitacion': 'HAB-AUDIT'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Timbrado')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        tim = crear_timbrado(nro_timbrado='40000002')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/timbrado/{tim.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Timbrado')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        payload = {**PAYLOAD_BASE, 'nro_timbrado': '40000003'}
        r = self.client.post('/api/timbrado/', payload)
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_datos_antes_y_despues_no_nulos(self):
        r = self.client.patch(f'/api/timbrado/{self.tim.id}/', {'nro_habilitacion': 'HAB-DATOS'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
