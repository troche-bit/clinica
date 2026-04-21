from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from .models import PerfilUsuario
from .serializers import (
    CustomTokenObtainPairSerializer,
    PerfilUsuarioSerializer,
    UsuarioCreateSerializer,
    UsuarioUpdateSerializer,
)

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class PerfilUsuarioViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PerfilUsuario.objects.select_related(
        'user', 'persona_rrhh__persona', 'medico_asignado__persona'
    ).all()

    def get_serializer_class(self):
        if self.action == 'create':
            return UsuarioCreateSerializer
        if self.action in ('update', 'partial_update'):
            return UsuarioUpdateSerializer
        return PerfilUsuarioSerializer

    def list(self, request):
        qs = self.get_queryset().order_by('user__username')
        search = request.query_params.get('search', '')
        if search:
            qs = qs.filter(user__username__icontains=search) | \
                 qs.filter(user__first_name__icontains=search) | \
                 qs.filter(user__last_name__icontains=search)
        rol = request.query_params.get('rol', '')
        if rol:
            qs = qs.filter(rol=rol)
        activo = request.query_params.get('activo', '')
        if activo in ('true', 'false'):
            qs = qs.filter(activo=activo == 'true')
        serializer = PerfilUsuarioSerializer(qs.distinct(), many=True)
        return Response(serializer.data)

    def create(self, request):
        serializer = UsuarioCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        perfil = serializer.save()
        return Response(PerfilUsuarioSerializer(perfil).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        perfil = self.get_object()
        return Response(PerfilUsuarioSerializer(perfil).data)

    def partial_update(self, request, pk=None):
        perfil = self.get_object()
        serializer = UsuarioUpdateSerializer(perfil, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        perfil = serializer.save()
        return Response(PerfilUsuarioSerializer(perfil).data)

    @action(detail=True, methods=['post'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        perfil = self.get_object()
        perfil.activo = not perfil.activo
        perfil.save()
        return Response(PerfilUsuarioSerializer(perfil).data)

    @action(detail=True, methods=['post'], url_path='resetear-password')
    def resetear_password(self, request, pk=None):
        perfil = self.get_object()
        nueva = request.data.get('nueva_password', '')
        if len(nueva) < 8:
            return Response(
                {'error': 'La contraseña debe tener al menos 8 caracteres.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        perfil.user.set_password(nueva)
        perfil.user.save()
        return Response({'ok': True})
