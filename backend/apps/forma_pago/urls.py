from rest_framework.routers import DefaultRouter
from .views import FormaPagoViewSet

router = DefaultRouter()
router.register(r'forma-pago', FormaPagoViewSet, basename='forma-pago')

urlpatterns = router.urls
