# urls.py
from rest_framework.routers import DefaultRouter
from .viewsets import DiaSemanaViewSet

router = DefaultRouter()
router.register(r'diasemana', DiaSemanaViewSet, basename='diasemana')

urlpatterns = router.urls