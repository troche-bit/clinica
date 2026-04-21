from rest_framework.routers import DefaultRouter
from .views import ConsultaViewSet

router = DefaultRouter()
router.register(r'consultas', ConsultaViewSet, basename='consultas')

urlpatterns = router.urls
