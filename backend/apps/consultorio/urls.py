from rest_framework.routers import DefaultRouter # Importamos el enrutador por defecto de Django REST Framework
from .views import ConsultorioViewSet # Importamos los ViewSets para cada modelo

router = DefaultRouter() # Creamos una instancia del enrutador
router.register(r'consultorio', ConsultorioViewSet, basename = 'consultorio') # Registramos el ViewSet de Países con el prefijo 'paises' y el nombre base 'pais'

urlpatterns = router.urls # Asignamos las URLs generadas por el enrutador a urlpatterns