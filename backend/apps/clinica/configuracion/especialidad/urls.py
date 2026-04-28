from rest_framework.routers import DefaultRouter
from .views import EspecialidadViewSet

router = DefaultRouter()
router.register(r'especialidad', EspecialidadViewSet, basename='especialidad')

urlpatterns = router.urls
