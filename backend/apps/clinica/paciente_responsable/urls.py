from rest_framework.routers import DefaultRouter
from .views import PacienteResponsableViewSet

router = DefaultRouter()
router.register(r"pacienteresponsable", PacienteResponsableViewSet, basename="pacienteresponsable")

urlpatterns = router.urls
