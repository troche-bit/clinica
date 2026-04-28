from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RegistroAuditoriaViewSet

router = DefaultRouter()
router.register(r'auditoria', RegistroAuditoriaViewSet, basename='auditoria')

urlpatterns = [
    path('', include(router.urls)),
]