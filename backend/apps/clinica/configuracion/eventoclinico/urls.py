from rest_framework.routers import DefaultRouter
from .views import EventoClinicoViewSet

router = DefaultRouter()
router.register(r'eventoclinico', EventoClinicoViewSet, basename='eventoclinico')

urlpatterns = router.urls
