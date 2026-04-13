from rest_framework.routers import DefaultRouter
from .views import HorarioPrestadorViewSet

router = DefaultRouter()
router.register(r"horario-prestador", HorarioPrestadorViewSet, basename="horario-prestador")

urlpatterns = router.urls
