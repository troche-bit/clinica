from rest_framework.routers import DefaultRouter # Importamos el router por defecto de DRF
from .views import TipoDocumentoViewSet, PersonaViewSet # Importamos los viewsets que hemos creado

router = DefaultRouter() # Creamos una instancia del router
router.register(r'tipo-documento', TipoDocumentoViewSet, basename='tipo-documento') # Registramos el viewset de TipoDocumento con el router
router.register(r'persona', PersonaViewSet, basename='persona') # Registramos el view

urlpatterns = router.urls # Obtenemos las URLs generadas por el router
