from rest_framework.routers import DefaultRouter
from .views import CobranzaViewSet

router = DefaultRouter()
router.register(r'cobranzas', CobranzaViewSet, basename='cobranzas')

urlpatterns = router.urls
