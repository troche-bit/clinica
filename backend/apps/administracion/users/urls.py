from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PerfilUsuarioViewSet

router = DefaultRouter()
router.register('usuarios', PerfilUsuarioViewSet, basename='usuarios')

urlpatterns = [
    path('', include(router.urls)),
]
