from rest_framework.routers import DefaultRouter
from .views import ConsultorioViewSet

router = DefaultRouter()
router.register(r'consultorio', ConsultorioViewSet, basename='consultorio')

urlpatterns = router.urls
