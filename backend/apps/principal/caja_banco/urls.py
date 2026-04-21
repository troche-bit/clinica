from rest_framework.routers import DefaultRouter
from .views import CuentaMcbViewSet, MovimientoCajaBancoViewSet

router = DefaultRouter()
router.register(r'cuentas-mcb', CuentaMcbViewSet, basename='cuentas-mcb')
router.register(r'movimientos-caja', MovimientoCajaBancoViewSet, basename='movimientos-caja')

urlpatterns = router.urls
