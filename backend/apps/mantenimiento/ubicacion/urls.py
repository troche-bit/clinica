from rest_framework.routers import DefaultRouter
from .views import PaisViewSet, DepartamentoViewSet, CiudadViewSet

router = DefaultRouter()
router.register(r'pais', PaisViewSet, basename='pais')
router.register(r'departamento', DepartamentoViewSet, basename='departamento')
router.register(r'ciudad', CiudadViewSet, basename='ciudad')

urlpatterns = router.urls
