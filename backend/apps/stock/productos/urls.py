from rest_framework.routers import DefaultRouter
from .views import GrupoViewSet, ProductoServicioViewSet

router = DefaultRouter()
router.register(r'grupos',    GrupoViewSet,           basename='grupos')
router.register(r'productos', ProductoServicioViewSet, basename='productos')

urlpatterns = router.urls
