from rest_framework.routers import DefaultRouter
from .views import TimbradoViewSet

router = DefaultRouter()
router.register(r'timbrado', TimbradoViewSet, basename='timbrado')

urlpatterns = router.urls
