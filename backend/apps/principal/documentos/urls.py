from rest_framework.routers import DefaultRouter
from .views import DocumentoDigPacienteViewSet

router = DefaultRouter()
router.register(r'documentos', DocumentoDigPacienteViewSet, basename='documentos')

urlpatterns = router.urls
