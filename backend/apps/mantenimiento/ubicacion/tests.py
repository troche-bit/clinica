from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from apps.mantenimiento.ubicacion.models import Pais, Departamento, Ciudad
from apps.administracion.persona.models import TipoDocumento, Persona
from apps.administracion.users.models import PerfilUsuario

User = get_user_model()


def crear_usuario(username, rol):
    u, _ = User.objects.get_or_create(username=username)
    u.set_password('Test1234!')
    u.save()
    PerfilUsuario.objects.update_or_create(user=u, defaults={'rol': rol, 'activo': True})
    # Retornar instancia fresca: el signal cachea el perfil con rol por defecto en el objeto u
    return User.objects.get(pk=u.pk)


class BaseUbicacion(APITestCase):
    """Fixtures comunes para todos los tests de ubicación."""

    def setUp(self):
        self.admin  = crear_usuario('ub_admin',  'admin')
        self.recep  = crear_usuario('ub_recep',  'recepcionista')
        self.medico = crear_usuario('ub_medico', 'medico')

        self.pais   = Pais.objects.create(descripcion='Paraguay')
        self.depto  = Departamento.objects.create(descripcion='Central', pais=self.pais)
        self.ciudad = Ciudad.objects.create(descripcion='Asuncion', departamento=self.depto)

    def auth(self, user):
        self.client.force_authenticate(user=user)


# ══════════════════════════════════════════════════════════════════════════════
# PERMISOS
# ══════════════════════════════════════════════════════════════════════════════

class PermisosTest(BaseUbicacion):
    """Verifica que cada rol acceda solo a lo que le corresponde."""

    # ── Pais ──────────────────────────────────────────────────────────────────

    def test_anonimo_no_puede_listar_paises(self):
        r = self.client.get('/api/pais/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_medico_puede_listar_paises(self):
        self.auth(self.medico)
        r = self.client.get('/api/pais/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_recep_puede_crear_pais(self):
        self.auth(self.recep)
        r = self.client.post('/api/pais/', {'descripcion': 'Brasil'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_medico_no_puede_crear_pais(self):
        self.auth(self.medico)
        r = self.client.post('/api/pais/', {'descripcion': 'Chile'})
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_puede_eliminar_pais(self):
        self.auth(self.admin)
        pais = Pais.objects.create(descripcion='Bolivia')
        r = self.client.delete(f'/api/pais/{pais.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_recep_no_puede_eliminar_pais(self):
        self.auth(self.recep)
        pais = Pais.objects.create(descripcion='Uruguay')
        r = self.client.delete(f'/api/pais/{pais.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonimo_no_puede_ver_eliminados(self):
        r = self.client.get('/api/pais/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_puede_ver_eliminados_pais(self):
        self.auth(self.admin)
        r = self.client.get('/api/pais/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    # ── Departamento ──────────────────────────────────────────────────────────

    def test_anonimo_no_puede_listar_departamentos(self):
        r = self.client.get('/api/departamento/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_recep_puede_crear_departamento(self):
        self.auth(self.recep)
        r = self.client.post('/api/departamento/', {'descripcion': 'Cordillera', 'pais': self.pais.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_medico_no_puede_eliminar_departamento(self):
        self.auth(self.medico)
        depto = Departamento.objects.create(descripcion='Misiones', pais=self.pais)
        r = self.client.delete(f'/api/departamento/{depto.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)

    # ── Ciudad ────────────────────────────────────────────────────────────────

    def test_anonimo_no_puede_listar_ciudades(self):
        r = self.client.get('/api/ciudad/')
        self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_recep_puede_crear_ciudad(self):
        self.auth(self.recep)
        r = self.client.post('/api/ciudad/', {'descripcion': 'Lambare', 'departamento': self.depto.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_medico_no_puede_eliminar_ciudad(self):
        self.auth(self.medico)
        ciudad = Ciudad.objects.create(descripcion='Luque', departamento=self.depto)
        r = self.client.delete(f'/api/ciudad/{ciudad.id}/')
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


# ══════════════════════════════════════════════════════════════════════════════
# PAÍS — CRUD
# ══════════════════════════════════════════════════════════════════════════════

class PaisCrudTest(BaseUbicacion):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_list_devuelve_solo_activos(self):
        pais_borrado = Pais.objects.create(descripcion='Argentina')
        pais_borrado.soft_delete()
        r = self.client.get('/api/pais/')
        ids = [p['id'] for p in r.data['results']]
        self.assertIn(self.pais.id, ids)
        self.assertNotIn(pais_borrado.id, ids)

    def test_retrieve_devuelve_pais(self):
        r = self.client.get(f'/api/pais/{self.pais.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['descripcion'], 'Paraguay')

    def test_retrieve_eliminado_devuelve_404(self):
        pais = Pais.objects.create(descripcion='Venezuela')
        pais.soft_delete()
        r = self.client.get(f'/api/pais/{pais.id}/')
        self.assertEqual(r.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_admin(self):
        r = self.client.post('/api/pais/', {'descripcion': 'Ecuador'})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Pais.objects.filter(descripcion='Ecuador').exists())

    def test_create_strips_espacios(self):
        r = self.client.post('/api/pais/', {'descripcion': '  Peru  '})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Peru')

    def test_create_duplicado_case_insensitive(self):
        r = self.client.post('/api/pais/', {'descripcion': 'paraguay'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_duplicado_con_mayusculas(self):
        r = self.client.post('/api/pais/', {'descripcion': 'PARAGUAY'})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/pais/{self.pais.id}/', {'descripcion': 'Paraguay Actualizado'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.pais.refresh_from_db()
        self.assertEqual(self.pais.descripcion, 'Paraguay Actualizado')

    def test_patch_mismo_nombre_no_falla(self):
        r = self.client.patch(f'/api/pais/{self.pais.id}/', {'descripcion': 'Paraguay'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_destroy_borra_logicamente(self):
        pais = Pais.objects.create(descripcion='Cuba')
        r = self.client.delete(f'/api/pais/{pais.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        pais.refresh_from_db()
        self.assertTrue(pais.is_deleted)

    def test_destroy_bloqueado_con_departamentos_activos(self):
        r = self.client.delete(f'/api/pais/{self.pais.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_eliminados_devuelve_borrados(self):
        pais = Pais.objects.create(descripcion='Haiti')
        pais.soft_delete()
        r = self.client.get('/api/pais/eliminados/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        ids = [p['id'] for p in r.data]
        self.assertIn(pais.id, ids)

    def test_descripcion_vacia_devuelve_400(self):
        r = self.client.post('/api/pais/', {'descripcion': ''})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)


# ══════════════════════════════════════════════════════════════════════════════
# DEPARTAMENTO — CRUD
# ══════════════════════════════════════════════════════════════════════════════

class DepartamentoCrudTest(BaseUbicacion):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_list_devuelve_solo_activos(self):
        d = Departamento.objects.create(descripcion='Ñeembucu', pais=self.pais)
        d.soft_delete()
        r = self.client.get('/api/departamento/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.depto.id, ids)
        self.assertNotIn(d.id, ids)

    def test_list_filtrado_por_pais(self):
        pais2 = Pais.objects.create(descripcion='Argentina')
        d2    = Departamento.objects.create(descripcion='Buenos Aires', pais=pais2)
        r = self.client.get(f'/api/departamento/?pais={self.pais.id}')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.depto.id, ids)
        self.assertNotIn(d2.id, ids)

    def test_create_admin(self):
        r = self.client.post('/api/departamento/', {'descripcion': 'Alto Parana', 'pais': self.pais.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_strips_espacios(self):
        r = self.client.post('/api/departamento/', {'descripcion': '  Caaguazu  ', 'pais': self.pais.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Caaguazu')

    def test_create_duplicado_mismo_pais(self):
        r = self.client.post('/api/departamento/', {'descripcion': 'central', 'pais': self.pais.id})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_misma_descripcion_pais_diferente_es_valido(self):
        pais2 = Pais.objects.create(descripcion='Argentina')
        r = self.client.post('/api/departamento/', {'descripcion': 'Central', 'pais': pais2.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/departamento/{self.depto.id}/', {'descripcion': 'Central Actualizado'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.depto.refresh_from_db()
        self.assertEqual(self.depto.descripcion, 'Central Actualizado')

    def test_patch_mismo_nombre_no_falla(self):
        r = self.client.patch(f'/api/departamento/{self.depto.id}/', {'descripcion': 'Central'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_destroy_borra_logicamente(self):
        d = Departamento.objects.create(descripcion='Caazapa', pais=self.pais)
        r = self.client.delete(f'/api/departamento/{d.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        d.refresh_from_db()
        self.assertTrue(d.is_deleted)

    def test_destroy_bloqueado_con_ciudades_activas(self):
        r = self.client.delete(f'/api/departamento/{self.depto.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_eliminados_devuelve_borrados(self):
        d = Departamento.objects.create(descripcion='Canindeyu', pais=self.pais)
        d.soft_delete()
        r = self.client.get('/api/departamento/eliminados/')
        ids = [x['id'] for x in r.data]
        self.assertIn(d.id, ids)

    def test_list_respuesta_incluye_pais_descripcion(self):
        r = self.client.get(f'/api/departamento/{self.depto.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['pais_descripcion'], 'Paraguay')


# ══════════════════════════════════════════════════════════════════════════════
# CIUDAD — CRUD
# ══════════════════════════════════════════════════════════════════════════════

class CiudadCrudTest(BaseUbicacion):

    def setUp(self):
        super().setUp()
        self.auth(self.admin)

    def test_list_devuelve_solo_activos(self):
        c = Ciudad.objects.create(descripcion='San Lorenzo', departamento=self.depto)
        c.soft_delete()
        r = self.client.get('/api/ciudad/')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.ciudad.id, ids)
        self.assertNotIn(c.id, ids)

    def test_list_filtrado_por_departamento(self):
        depto2  = Departamento.objects.create(descripcion='Cordillera', pais=self.pais)
        ciudad2 = Ciudad.objects.create(descripcion='Caacupe', departamento=depto2)
        r = self.client.get(f'/api/ciudad/?departamento={self.depto.id}')
        ids = [x['id'] for x in r.data['results']]
        self.assertIn(self.ciudad.id, ids)
        self.assertNotIn(ciudad2.id, ids)

    def test_create_admin(self):
        r = self.client.post('/api/ciudad/', {'descripcion': 'Fernando de la Mora', 'departamento': self.depto.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_create_strips_espacios(self):
        r = self.client.post('/api/ciudad/', {'descripcion': '  Capiatá  ', 'departamento': self.depto.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(r.data['descripcion'], 'Capiatá')

    def test_create_duplicado_mismo_departamento(self):
        r = self.client.post('/api/ciudad/', {'descripcion': 'asuncion', 'departamento': self.depto.id})
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_misma_descripcion_departamento_diferente_es_valido(self):
        depto2 = Departamento.objects.create(descripcion='Cordillera', pais=self.pais)
        r = self.client.post('/api/ciudad/', {'descripcion': 'Asuncion', 'departamento': depto2.id})
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)

    def test_patch_descripcion(self):
        r = self.client.patch(f'/api/ciudad/{self.ciudad.id}/', {'descripcion': 'Asuncion Capital'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.ciudad.refresh_from_db()
        self.assertEqual(self.ciudad.descripcion, 'Asuncion Capital')

    def test_patch_mismo_nombre_no_falla(self):
        r = self.client.patch(f'/api/ciudad/{self.ciudad.id}/', {'descripcion': 'Asuncion'})
        self.assertEqual(r.status_code, status.HTTP_200_OK)

    def test_destroy_borra_logicamente(self):
        c = Ciudad.objects.create(descripcion='Ita', departamento=self.depto)
        r = self.client.delete(f'/api/ciudad/{c.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        c.refresh_from_db()
        self.assertTrue(c.is_deleted)

    def test_eliminados_devuelve_borrados(self):
        c = Ciudad.objects.create(descripcion='Ypacarai', departamento=self.depto)
        c.soft_delete()
        r = self.client.get('/api/ciudad/eliminados/')
        ids = [x['id'] for x in r.data]
        self.assertIn(c.id, ids)

    def test_list_respuesta_incluye_departamento_descripcion(self):
        r = self.client.get(f'/api/ciudad/{self.ciudad.id}/')
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(r.data['departamento_descripcion'], 'Central')


# ══════════════════════════════════════════════════════════════════════════════
# RESTRICCIONES — Personas activas bloquean el borrado
# ══════════════════════════════════════════════════════════════════════════════

class ConstraintPersonasTest(BaseUbicacion):
    """
    Verifica que ningún nivel de la jerarquía pueda eliminarse mientras tenga
    personas activas vinculadas directamente.
    """

    def setUp(self):
        super().setUp()
        self.auth(self.admin)
        self.tipo_doc = TipoDocumento.objects.create(descripcion='Cedula de identidad')

    def _crear_persona(self, **kwargs):
        base = dict(
            tipo_documento=self.tipo_doc,
            nro_documento='12345678',
            razon_social='Test Persona',
        )
        base.update(kwargs)
        return Persona.objects.create(**base)

    def test_ciudad_con_persona_activa_no_puede_eliminarse(self):
        ciudad2 = Ciudad.objects.create(descripcion='Villa Elisa', departamento=self.depto)
        self._crear_persona(ciudad=ciudad2, nro_documento='11111111')
        r = self.client.delete(f'/api/ciudad/{ciudad2.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_departamento_con_persona_activa_no_puede_eliminarse(self):
        depto2 = Departamento.objects.create(descripcion='Paraguary', pais=self.pais)
        self._crear_persona(departamento=depto2, nro_documento='22222222')
        r = self.client.delete(f'/api/departamento/{depto2.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_pais_con_persona_activa_no_puede_eliminarse(self):
        pais2 = Pais.objects.create(descripcion='Mexico')
        self._crear_persona(pais=pais2, nro_documento='33333333')
        r = self.client.delete(f'/api/pais/{pais2.id}/')
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_ciudad_sin_personas_puede_eliminarse(self):
        ciudad2 = Ciudad.objects.create(descripcion='Guarambare', departamento=self.depto)
        r = self.client.delete(f'/api/ciudad/{ciudad2.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_departamento_sin_ciudades_ni_personas_puede_eliminarse(self):
        depto2 = Departamento.objects.create(descripcion='Boqueron', pais=self.pais)
        r = self.client.delete(f'/api/departamento/{depto2.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)

    def test_pais_sin_departamentos_ni_personas_puede_eliminarse(self):
        pais2 = Pais.objects.create(descripcion='Panama')
        r = self.client.delete(f'/api/pais/{pais2.id}/')
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
