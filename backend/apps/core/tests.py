from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone

from apps.clinica.configuracion.consultorio.models import Consultorio

User = get_user_model()


class BaseModelTest(TestCase):
    """Prueba el comportamiento de BaseModel a través de Consultorio (modelo concreto)."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123',
        )
        self.consultorio = Consultorio.objects.create(
            nro_consultorio='C-TEST-01',
            id_usu_creator=self.user,
        )

    # --- Valores por defecto ---

    def test_is_deleted_default_es_false(self):
        self.assertFalse(self.consultorio.is_deleted)

    def test_fecha_eliminacion_default_es_none(self):
        self.assertIsNone(self.consultorio.fecha_eliminacion)

    def test_fecha_creacion_se_asigna_automaticamente(self):
        self.assertIsNotNone(self.consultorio.fecha_creacion)

    def test_fecha_modificacion_se_asigna_automaticamente(self):
        self.assertIsNotNone(self.consultorio.fecha_modificacion)

    # --- soft_delete() ---

    def test_soft_delete_marca_is_deleted(self):
        self.consultorio.soft_delete()
        self.assertTrue(self.consultorio.is_deleted)

    def test_soft_delete_registra_fecha_eliminacion(self):
        antes = timezone.now()
        self.consultorio.soft_delete()
        despues = timezone.now()
        self.assertIsNotNone(self.consultorio.fecha_eliminacion)
        self.assertGreaterEqual(self.consultorio.fecha_eliminacion, antes)
        self.assertLessEqual(self.consultorio.fecha_eliminacion, despues)

    def test_soft_delete_no_elimina_el_registro_de_db(self):
        self.consultorio.soft_delete()
        self.assertTrue(Consultorio.objects.filter(pk=self.consultorio.pk).exists())

    def test_soft_delete_persiste_en_db(self):
        self.consultorio.soft_delete()
        desde_db = Consultorio.objects.get(pk=self.consultorio.pk)
        self.assertTrue(desde_db.is_deleted)
        self.assertIsNotNone(desde_db.fecha_eliminacion)

    # --- restore() ---

    def test_restore_desmarca_is_deleted(self):
        self.consultorio.soft_delete()
        self.consultorio.restore()
        self.assertFalse(self.consultorio.is_deleted)

    def test_restore_limpia_fecha_eliminacion(self):
        self.consultorio.soft_delete()
        self.consultorio.restore()
        self.assertIsNone(self.consultorio.fecha_eliminacion)

    def test_restore_persiste_en_db(self):
        self.consultorio.soft_delete()
        self.consultorio.restore()
        desde_db = Consultorio.objects.get(pk=self.consultorio.pk)
        self.assertFalse(desde_db.is_deleted)
        self.assertIsNone(desde_db.fecha_eliminacion)

    def test_restore_mantiene_el_registro_en_db(self):
        self.consultorio.soft_delete()
        self.consultorio.restore()
        self.assertTrue(Consultorio.objects.filter(pk=self.consultorio.pk).exists())
