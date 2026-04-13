from rest_framework.routers import DefaultRouter # Importamos el enrutador por defecto de Django REST Framework
from .views import PaisViewSet, DepartamentoViewSet, CiudadViewSet # Importamos los ViewSets para cada modelo

router = DefaultRouter() # Creamos una instancia del enrutador
router.register(r'pais', PaisViewSet, basename = 'pais') # Registramos el ViewSet de Países con el prefijo 'paises' y el nombre base 'pais'
router.register(r'departamento', DepartamentoViewSet, basename = 'departamento') # Registramos el ViewSet de Departamentos con el prefijo 'departamentos' y el nombre base 'departamento'
router.register(r'ciudad', CiudadViewSet, basename = 'ciudad') # Registramos el ViewSet de Ciudades con el prefijo 'ciudades' y el nombre base 'ciudad'

urlpatterns = router.urls # Asignamos las URLs generadas por el enrutador a urlpatterns