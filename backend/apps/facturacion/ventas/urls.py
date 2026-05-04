from rest_framework.routers import DefaultRouter
from .views import VentaFactCabViewSet

router = DefaultRouter()
router.register(r'facturacion', VentaFactCabViewSet, basename='facturacion')

urlpatterns = router.urls
