from rest_framework.routers import DefaultRouter
from .views import TipoDocumentoViewSet, PersonaViewSet

router = DefaultRouter()
router.register(r'tipo-documento', TipoDocumentoViewSet, basename='tipo-documento')
router.register(r'persona', PersonaViewSet, basename='persona')

urlpatterns = router.urls
