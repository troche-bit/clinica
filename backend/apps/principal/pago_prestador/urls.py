from rest_framework.routers import DefaultRouter
from .views import PagoPrestadorViewSet

router = DefaultRouter()
router.register(r'pago-prestador', PagoPrestadorViewSet, basename='pago-prestador')

urlpatterns = router.urls
