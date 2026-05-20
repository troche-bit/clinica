from rest_framework.routers import DefaultRouter
from .views import DocumentoDigPacienteViewSet, DocumentoDigPrestadorViewSet

router = DefaultRouter()
router.register(r'documentos', DocumentoDigPacienteViewSet, basename='documentos')
router.register(r'documentos-prestador', DocumentoDigPrestadorViewSet, basename='documentos-prestador')

urlpatterns = router.urls
