from rest_framework.routers import DefaultRouter
from .views import RecordatorioViewSet, NotificacionViewSet

router = DefaultRouter()
router.register(r'recordatorios',   RecordatorioViewSet,   basename='recordatorios')
router.register(r'notificaciones',  NotificacionViewSet,   basename='notificaciones')

urlpatterns = router.urls
