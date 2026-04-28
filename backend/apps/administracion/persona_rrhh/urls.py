from rest_framework.routers import DefaultRouter
from .views import PersonaRRHHViewSet

router = DefaultRouter()
router.register(r"personarrhh", PersonaRRHHViewSet, basename="personarrhh")

urlpatterns = router.urls
