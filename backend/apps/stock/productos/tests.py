from datetime import date, timedelta
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.stock.productos.models import Grupo, ProductoServicio
from apps.administracion.auditoria.models import RegistroAuditoria
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()

HOY    = date.today()
INICIO = HOY - timedelta(days=30)
FIN    = HOY + timedelta(days=365)


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    return User.objects.get(pk=u.pk)


def crear_grupo(**kwargs):
    defaults = {'descripcion': 'Consultas', 'activo': True}
    defaults.update(kwargs)
    return Grupo.objects.create(**defaults)


def crear_producto(grupo, **kwargs):
    defaults = {
        'descripcion': 'Consulta general',
        'grupo': grupo,
        'impuesto': ProductoServicio.IVA_10,
        'activo': True,
    }
    defaults.update(kwargs)
    return ProductoServicio.objects.create(**defaults)


# ══════════════════════════════════════════════════════════════════════════════
# BASE
# ══════════════════════════════════════════════════════════════════════════════

class BaseGrupo(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('sp_g_admin',  'admin')
        self.recep  = crear_usuario('sp_g_recep',  'recepcionista')
        self.medico = crear_usuario('sp_g_medico', 'medico')
        self.grupo  = crear_grupo()

    def auth(self, user):
        self.client.force_authenticate(user=user)


class BaseProducto(APITestCase):

    def setUp(self):
        self.admin  = crear_usuario('sp_p_admin',  'admin')
        self.recep  = crear_usuario('sp_p_recep',  'recepcionista')
        self.medico = crear_usuario('sp_p_medico', 'medico')
        self.grupo  = crear_grupo(descripcion='Servicios')
        self.prod   = crear_producto(self.grupo)

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS — GRUPO
# ══════════════════════════════════════════════════════════════════════════════

class PermisosGrupoTest(BaseGrupo):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/grupos/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/grupos/', {'descripcion': 'Nuevo'})
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/grupos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/grupos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/grupos/{self.grupo.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/grupos/', {'descripcion': 'X'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'descripcion': 'Y'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/grupos/{self.grupo.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/grupos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/grupos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/grupos/', {'descripcion': 'Medicamentos'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'descripcion': 'Consultas Editado'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/grupos/{self.grupo.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/grupos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        r = self.client.post('/api/grupos/', {'descripcion': 'Insumos'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_editar(self):
        self.auth(self.admin)
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'activo': False})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        g = crear_grupo(descripcion='Para Eliminar Admin')
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/grupos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD — GRUPO
# ══════════════════════════════════════════════════════════════════════════════

class GrupoCrudTest(BaseGrupo):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrado = crear_grupo(descripcion='Borrado List')
        borrado.soft_delete()
        r = self.client.get('/api/grupos/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.grupo.id, ids)
        self.assertNotIn(borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/grupos/')
        item = next(x for x in r.data['results'] if x['id'] == self.grupo.id)
        for campo in ['id', 'descripcion', 'activo', 'total_productos',
                      'fecha_creacion', 'fecha_modificacion']:
            self.assertIn(campo, item)

    def test_list_busqueda(self):
        crear_grupo(descripcion='Radiología')
        r = self.client.get('/api/grupos/?search=Radiolog')
        resultados = r.data['results']
        self.assertTrue(all('radiolog' in x['descripcion'].lower() for x in resultados))

    def test_list_filtro_activo_true(self):
        inactivo = crear_grupo(descripcion='Inactivo Filtro', activo=False)
        r = self.client.get('/api/grupos/?activo=true')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(inactivo.id, ids)

    def test_list_filtro_activo_false(self):
        inactivo = crear_grupo(descripcion='Inactivo Filtro 2', activo=False)
        r = self.client.get('/api/grupos/?activo=false')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(inactivo.id, ids)
        self.assertNotIn(self.grupo.id, ids)

    def test_list_total_productos_anotado(self):
        crear_producto(self.grupo, descripcion='Prod A')
        r = self.client.get('/api/grupos/')
        item = next(x for x in r.data['results'] if x['id'] == self.grupo.id)
        self.assertGreaterEqual(item['total_productos'], 1)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_grupo(self):
        r = self.client.get(f'/api/grupos/{self.grupo.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['descripcion'], 'Consultas')

    def test_retrieve_eliminado_devuelve_404(self):
        g = crear_grupo(descripcion='Retrieve Borrado')
        g.soft_delete()
        r = self.client.get(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/grupos/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido(self):
        r = self.client.post('/api/grupos/', {'descripcion': 'Laboratorio'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Laboratorio')

    def test_create_strip_espacios(self):
        r = self.client.post('/api/grupos/', {'descripcion': '  Farmacia  '})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Farmacia')

    def test_create_duplicado_exacto_retorna_400(self):
        r = self.client.post('/api/grupos/', {'descripcion': 'Consultas'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_case_insensitive_retorna_400(self):
        r = self.client.post('/api/grupos/', {'descripcion': 'CONSULTAS'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_mayusculas_retorna_400(self):
        r = self.client.post('/api/grupos/', {'descripcion': 'consultas'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_vacio_retorna_400(self):
        r = self.client.post('/api/grupos/', {'descripcion': ''})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_reutilizable_tras_borrado(self):
        g = crear_grupo(descripcion='Reciclable')
        g.soft_delete()
        r = self.client.post('/api/grupos/', {'descripcion': 'Reciclable'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'descripcion': 'Consultas Patch'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.grupo.refresh_from_db()
        self.assertEqual(self.grupo.descripcion, 'Consultas Patch')

    def test_patch_activo(self):
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'activo': False})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.grupo.refresh_from_db()
        self.assertFalse(self.grupo.activo)

    def test_patch_mismo_valor_no_falla(self):
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'descripcion': 'Consultas'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_duplicado_de_otro_retorna_400(self):
        crear_grupo(descripcion='Otro Grupo')
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'descripcion': 'Otro Grupo'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted(self):
        g = crear_grupo(descripcion='Para Borrar')
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        g.refresh_from_db()
        self.assertTrue(g.is_deleted)
        self.assertIsNotNone(g.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        g = crear_grupo(descripcion='Borrar List')
        self.client.delete(f'/api/grupos/{g.id}/')
        r = self.client.get('/api/grupos/')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(g.id, ids)

    def test_destroy_ya_borrado_retorna_404(self):
        g = crear_grupo(descripcion='Ya Borrado')
        g.soft_delete()
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        g = crear_grupo(descripcion='Eliminado Eliimn')
        g.soft_delete()
        r = self.client.get('/api/grupos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x['id'] for x in r.data]
        self.assertIn(g.id, ids)
        self.assertNotIn(self.grupo.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/grupos/eliminados/')
        self.assertIsInstance(r.data, list)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Productos activos bloquean borrado del grupo
# ══════════════════════════════════════════════════════════════════════════════

class GrupoConstraintTest(BaseGrupo):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_grupo_con_producto_activo_no_puede_eliminarse(self):
        g = crear_grupo(descripcion='Con Producto Activo')
        crear_producto(g, descripcion='Producto Activo')
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        g.refresh_from_db()
        self.assertFalse(g.is_deleted)

    def test_error_menciona_producto(self):
        g = crear_grupo(descripcion='Con Producto Error')
        crear_producto(g, descripcion='Prod Error')
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertIn('producto', str(r.data).lower())

    def test_grupo_con_solo_producto_borrado_puede_eliminarse(self):
        g = crear_grupo(descripcion='Solo Prod Borrado')
        p = crear_producto(g, descripcion='Prod Borrado')
        p.soft_delete()
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        g.refresh_from_db()
        self.assertTrue(g.is_deleted)

    def test_grupo_con_producto_inactivo_puede_eliminarse(self):
        g = crear_grupo(descripcion='Solo Prod Inactivo')
        crear_producto(g, descripcion='Prod Inactivo', activo=False)
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_grupo_sin_productos_puede_eliminarse(self):
        g = crear_grupo(descripcion='Sin Productos')
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA — GRUPO
# ══════════════════════════════════════════════════════════════════════════════

class GrupoAuditoriaTest(BaseGrupo):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/grupos/', {'descripcion': 'Audit Crear'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Grupo')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'descripcion': 'Audit Editar'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Grupo')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        g = crear_grupo(descripcion='Audit Eliminar')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/grupos/{g.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'Grupo')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/grupos/', {'descripcion': 'Audit Usuario'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_datos_antes_y_despues_no_nulos(self):
        r = self.client.patch(f'/api/grupos/{self.grupo.id}/', {'descripcion': 'Audit Datos'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS — PRODUCTO/SERVICIO
# ══════════════════════════════════════════════════════════════════════════════

class PermisosProductoTest(BaseProducto):

    def test_anonimo_no_puede_listar(self):
        r = self.client.get('/api/productos/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_crear(self):
        r = self.client.post('/api/productos/', {
            'descripcion': 'Nuevo', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/productos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar(self):
        self.auth(self.medico)
        r = self.client.get('/api/productos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_puede_retrieve(self):
        self.auth(self.medico)
        r = self.client.get(f'/api/productos/{self.prod.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_medico_no_puede_crear(self):
        self.auth(self.medico)
        r = self.client.post('/api/productos/', {
            'descripcion': 'X', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_editar(self):
        self.auth(self.medico)
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'descripcion': 'Y'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_eliminar(self):
        self.auth(self.medico)
        r = self.client.delete(f'/api/productos/{self.prod.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_medico_no_puede_ver_eliminados(self):
        self.auth(self.medico)
        r = self.client.get('/api/productos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_puede_listar(self):
        self.auth(self.recep)
        r = self.client.get('/api/productos/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear(self):
        self.auth(self.recep)
        r = self.client.post('/api/productos/', {
            'descripcion': 'Recep Crea', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_recep_puede_editar(self):
        self.auth(self.recep)
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'activo': False})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_no_puede_eliminar(self):
        self.auth(self.recep)
        r = self.client.delete(f'/api/productos/{self.prod.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_recep_no_puede_ver_eliminados(self):
        self.auth(self.recep)
        r = self.client.get('/api/productos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_crear(self):
        self.auth(self.admin)
        r = self.client.post('/api/productos/', {
            'descripcion': 'Admin Crea', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_admin_puede_editar(self):
        self.auth(self.admin)
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'impuesto': '5'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_admin_puede_eliminar(self):
        self.auth(self.admin)
        p = crear_producto(self.grupo, descripcion='Para Eliminar Perm')
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_admin_puede_ver_eliminados(self):
        self.auth(self.admin)
        r = self.client.get('/api/productos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# CRUD — PRODUCTO/SERVICIO
# ══════════════════════════════════════════════════════════════════════════════

class ProductoCrudTest(BaseProducto):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    # ── List ──────────────────────────────────────────────────────────────────

    def test_list_devuelve_solo_activos(self):
        borrado = crear_producto(self.grupo, descripcion='Borrado List Prod')
        borrado.soft_delete()
        r = self.client.get('/api/productos/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.prod.id, ids)
        self.assertNotIn(borrado.id, ids)

    def test_list_campos_serializados(self):
        r = self.client.get('/api/productos/')
        item = next(x for x in r.data['results'] if x['id'] == self.prod.id)
        for campo in ['id', 'descripcion', 'grupo', 'grupo_nombre',
                      'impuesto', 'impuesto_display', 'activo',
                      'fecha_creacion', 'fecha_modificacion']:
            self.assertIn(campo, item)

    def test_list_busqueda(self):
        crear_producto(self.grupo, descripcion='Ecografía Abdominal')
        r = self.client.get('/api/productos/?search=Ecograf')
        resultados = r.data['results']
        self.assertTrue(all('ecograf' in x['descripcion'].lower() for x in resultados))

    def test_list_filtro_grupo(self):
        otro_grupo = crear_grupo(descripcion='Otro Grupo Prod')
        p_otro = crear_producto(otro_grupo, descripcion='Prod Otro Grupo')
        r = self.client.get(f'/api/productos/?grupo={self.grupo.id}')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.prod.id, ids)
        self.assertNotIn(p_otro.id, ids)

    def test_list_filtro_activo_true(self):
        inactivo = crear_producto(self.grupo, descripcion='Inactivo Prod', activo=False)
        r = self.client.get('/api/productos/?activo=true')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(inactivo.id, ids)

    def test_list_filtro_activo_false(self):
        inactivo = crear_producto(self.grupo, descripcion='Inactivo Prod 2', activo=False)
        r = self.client.get('/api/productos/?activo=false')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(inactivo.id, ids)
        self.assertNotIn(self.prod.id, ids)

    # ── Retrieve ──────────────────────────────────────────────────────────────

    def test_retrieve_devuelve_producto(self):
        r = self.client.get(f'/api/productos/{self.prod.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['descripcion'], 'Consulta general')

    def test_retrieve_campo_grupo_nombre(self):
        r = self.client.get(f'/api/productos/{self.prod.id}/')
        self.assertEqual(r.data['grupo_nombre'], 'Servicios')

    def test_retrieve_campo_impuesto_display(self):
        r = self.client.get(f'/api/productos/{self.prod.id}/')
        self.assertEqual(r.data['impuesto_display'], 'IVA 10%')

    def test_retrieve_eliminado_devuelve_404(self):
        p = crear_producto(self.grupo, descripcion='Retrieve Borrado Prod')
        p.soft_delete()
        r = self.client.get(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_retrieve_inexistente_devuelve_404(self):
        r = self.client.get('/api/productos/99999/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Create ────────────────────────────────────────────────────────────────

    def test_create_valido(self):
        r = self.client.post('/api/productos/', {
            'descripcion': 'Radiografía', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Radiografía')

    def test_create_strip_espacios(self):
        r = self.client.post('/api/productos/', {
            'descripcion': '  Ecografía  ', 'grupo': self.grupo.id, 'impuesto': '5',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Ecografía')

    def test_create_duplicado_mismo_grupo_retorna_400(self):
        r = self.client.post('/api/productos/', {
            'descripcion': 'Consulta general', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_case_insensitive_mismo_grupo_retorna_400(self):
        r = self.client.post('/api/productos/', {
            'descripcion': 'CONSULTA GENERAL', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_mismo_nombre_diferente_grupo_valido(self):
        otro = crear_grupo(descripcion='Otro Grupo 2')
        r = self.client.post('/api/productos/', {
            'descripcion': 'Consulta general', 'grupo': otro.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_vacio_retorna_400(self):
        r = self.client.post('/api/productos/', {
            'descripcion': '', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_sin_grupo_retorna_400(self):
        r = self.client.post('/api/productos/', {
            'descripcion': 'Sin Grupo', 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_impuesto_exenta_valido(self):
        r = self.client.post('/api/productos/', {
            'descripcion': 'Producto Exento', 'grupo': self.grupo.id, 'impuesto': 'exenta',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_reutilizable_tras_borrado(self):
        p = crear_producto(self.grupo, descripcion='Reciclable Prod')
        p.soft_delete()
        r = self.client.post('/api/productos/', {
            'descripcion': 'Reciclable Prod', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    # ── Patch ─────────────────────────────────────────────────────────────────

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'descripcion': 'Consulta Patch'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.descripcion, 'Consulta Patch')

    def test_patch_impuesto(self):
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'impuesto': '5'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.prod.refresh_from_db()
        self.assertEqual(self.prod.impuesto, '5')

    def test_patch_mismo_valor_no_falla(self):
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'descripcion': 'Consulta general'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_patch_duplicado_de_otro_retorna_400(self):
        crear_producto(self.grupo, descripcion='Otro Producto')
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'descripcion': 'Otro Producto'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_cambio_de_grupo_valido(self):
        otro = crear_grupo(descripcion='Nuevo Grupo Patch')
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'grupo': otro.id})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # ── Destroy ───────────────────────────────────────────────────────────────

    def test_destroy_marca_is_deleted(self):
        p = crear_producto(self.grupo, descripcion='Para Borrar Prod')
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        p.refresh_from_db()
        self.assertTrue(p.is_deleted)
        self.assertIsNotNone(p.fecha_eliminacion)

    def test_destroy_no_aparece_en_list(self):
        p = crear_producto(self.grupo, descripcion='Borrar List Prod 2')
        self.client.delete(f'/api/productos/{p.id}/')
        r = self.client.get('/api/productos/')
        ids = [x['id'] for x in r.data['results']]
        self.assertNotIn(p.id, ids)

    def test_destroy_ya_borrado_retorna_404(self):
        p = crear_producto(self.grupo, descripcion='Ya Borrado Prod')
        p.soft_delete()
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    # ── Eliminados ────────────────────────────────────────────────────────────

    def test_eliminados_lista_solo_borrados(self):
        p = crear_producto(self.grupo, descripcion='Eliminado Prod')
        p.soft_delete()
        r = self.client.get('/api/productos/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [x['id'] for x in r.data]
        self.assertIn(p.id, ids)
        self.assertNotIn(self.prod.id, ids)

    def test_eliminados_no_paginado(self):
        r = self.client.get('/api/productos/eliminados/')
        self.assertIsInstance(r.data, list)


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIÓN — Facturas activas bloquean borrado del producto
# ══════════════════════════════════════════════════════════════════════════════

class ProductoConstraintTest(BaseProducto):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        from apps.facturacion.ventas.models import VentaFactCab, VentaFactDet
        from apps.facturacion.configuracion.timbrado.models import Timbrado
        from apps.administracion.persona.models import TipoDocumento, Persona
        self.VentaFactDet = VentaFactDet
        tipo_doc = TipoDocumento.objects.create(descripcion='CI-PROD-TEST')
        self.persona = Persona.objects.create(
            tipo_documento=tipo_doc,
            nro_documento='99800001',
            razon_social='Cliente Prod Test',
        )
        self.timbrado = Timbrado.objects.create(
            nro_timbrado='19990001',
            inicio_vigencia=INICIO,
            fin_vigencia=FIN,
            punto_sucursal='001',
            punto_expedicion='001',
            nro_desde=1,
            nro_hasta=9999,
            autoimpresor=False,
        )
        self.VentaFactCab = VentaFactCab

    def _crear_detalle(self, producto, is_deleted=False):
        cab = self.VentaFactCab.objects.create(
            fecha=HOY,
            persona=self.persona,
            timbrado=self.timbrado,
            nro_comprobante=None,
        )
        det = self.VentaFactDet.objects.create(
            vfc=cab,
            prs=producto,
            cantidad=1,
            monto=100000,
            impuesto='10',
        )
        if is_deleted:
            det.soft_delete()
        return det

    def test_producto_con_factura_activa_no_puede_eliminarse(self):
        p = crear_producto(self.grupo, descripcion='Prod Con Factura')
        self._crear_detalle(p)
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
        p.refresh_from_db()
        self.assertFalse(p.is_deleted)

    def test_error_menciona_factura(self):
        p = crear_producto(self.grupo, descripcion='Prod Error Factura')
        self._crear_detalle(p)
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertIn('factura', str(r.data).lower())

    def test_producto_con_solo_detalle_borrado_puede_eliminarse(self):
        p = crear_producto(self.grupo, descripcion='Prod Det Borrado')
        self._crear_detalle(p, is_deleted=True)
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        p.refresh_from_db()
        self.assertTrue(p.is_deleted)

    def test_producto_sin_facturas_puede_eliminarse(self):
        p = crear_producto(self.grupo, descripcion='Prod Sin Facturas')
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)


# ══════════════════════════════════════════════════════════════════════════════
# AUDITORÍA — PRODUCTO/SERVICIO
# ══════════════════════════════════════════════════════════════════════════════

class ProductoAuditoriaTest(BaseProducto):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_create_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.post('/api/productos/', {
            'descripcion': 'Audit Crear Prod', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'ProductoServicio')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.CREAR)

    def test_patch_registra_auditoria(self):
        antes = RegistroAuditoria.objects.count()
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'descripcion': 'Audit Editar Prod'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'ProductoServicio')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.EDITAR)

    def test_delete_registra_auditoria(self):
        p = crear_producto(self.grupo, descripcion='Audit Eliminar Prod')
        antes = RegistroAuditoria.objects.count()
        r = self.client.delete(f'/api/productos/{p.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(RegistroAuditoria.objects.count(), antes + 1)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.tabla, 'ProductoServicio')
        self.assertEqual(reg.accion, RegistroAuditoria.Accion.ELIMINAR)

    def test_create_registra_usuario_correcto(self):
        r = self.client.post('/api/productos/', {
            'descripcion': 'Audit Usuario Prod', 'grupo': self.grupo.id, 'impuesto': '10',
        })
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertEqual(reg.usuario, self.admin)

    def test_patch_datos_antes_y_despues_no_nulos(self):
        r = self.client.patch(f'/api/productos/{self.prod.id}/', {'descripcion': 'Audit Datos Prod'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        reg = RegistroAuditoria.objects.latest('id')
        self.assertIsNotNone(reg.datos_antes)
        self.assertIsNotNone(reg.datos_despues)
