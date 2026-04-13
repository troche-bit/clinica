from rest_framework.routers import DefaultRouter
from .views import TipoDocDigitalViewSet

router = DefaultRouter()
router.register(r"tipo-doc-dig", TipoDocDigitalViewSet, basename="tipo-doc-dig")

urlpatterns = router.urls
