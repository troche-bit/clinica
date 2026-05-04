from django.contrib.auth import get_user_model
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from apps.core.permissions import IsAdminRole
from apps.administracion.auditoria.models import RegistroAuditoria
from .models import PerfilUsuario
from .serializers import (
    CustomTokenObtainPairSerializer,
    PerfilUsuarioSerializer,
    UsuarioCreateSerializer,
    UsuarioUpdateSerializer,
)

User = get_user_model()


def _log(request, registro_id, accion, datos_antes=None, datos_despues=None):
    try:
        x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_fwd.split(',')[0].strip() if x_fwd else request.META.get('REMOTE_ADDR')
        RegistroAuditoria.objects.create(
            tabla='PerfilUsuario', registro_id=registro_id, accion=accion,
            datos_antes=datos_antes, datos_despues=datos_despues,
            usuario=request.user, ip=ip,
        )
    except Exception:
        pass


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class PerfilUsuarioViewSet(viewsets.GenericViewSet):
    queryset = PerfilUsuario.objects.select_related(
        'user', 'persona_rrhh__persona'
    ).prefetch_related('medicos_asignados__persona').all()

    def get_permissions(self):
        if self.action in ('me', 'cambiar_password'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

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
        return Response(PerfilUsuarioSerializer(qs.distinct(), many=True).data)

    def create(self, request):
        serializer = UsuarioCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        perfil = serializer.save()
        _log(request, perfil.id, RegistroAuditoria.Accion.CREAR,
             datos_antes=None,
             datos_despues={'usuario': perfil.user.username, 'rol': perfil.rol, 'activo': perfil.activo})
        return Response(PerfilUsuarioSerializer(perfil).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        perfil = self.get_object()
        return Response(PerfilUsuarioSerializer(perfil).data)

    def partial_update(self, request, pk=None):
        perfil = self.get_object()
        if perfil.user.is_superuser and 'rol' in request.data:
            raise ValidationError('No se puede cambiar el rol del usuario master.')
        datos_antes = {
            'first_name': perfil.user.first_name,
            'last_name': perfil.user.last_name,
            'email': perfil.user.email,
            'rol': perfil.rol,
        }
        serializer = UsuarioUpdateSerializer(perfil, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        perfil = serializer.save()
        _log(request, perfil.id, RegistroAuditoria.Accion.EDITAR,
             datos_antes=datos_antes,
             datos_despues={
                 'first_name': perfil.user.first_name,
                 'last_name': perfil.user.last_name,
                 'email': perfil.user.email,
                 'rol': perfil.rol,
             })
        return Response(PerfilUsuarioSerializer(perfil).data)

    @action(detail=False, methods=['get'])
    def me(self, request):
        try:
            perfil = request.user.perfil
        except PerfilUsuario.DoesNotExist:
            raise PermissionDenied('El usuario no tiene perfil asociado.')
        return Response(PerfilUsuarioSerializer(perfil).data)

    @action(detail=False, methods=['post'], url_path='cambiar-password')
    def cambiar_password(self, request):
        user = request.user
        current = request.data.get('current_password', '')
        nueva = request.data.get('nueva_password', '')
        if len(nueva) < 8:
            raise ValidationError('La contraseña debe tener al menos 8 caracteres.')
        if not user.check_password(current):
            raise ValidationError('La contraseña actual es incorrecta.')
        if user.check_password(nueva):
            raise ValidationError('La nueva contraseña no puede ser igual a la actual.')
        user.set_password(nueva)
        user.save()
        try:
            perfil_id = user.perfil.id
        except Exception:
            perfil_id = 0
        _log(request, perfil_id, RegistroAuditoria.Accion.EDITAR,
             datos_antes={'contraseña': '***'},
             datos_despues={'contraseña': '*** (modificada por el propio usuario)'})
        return Response({'ok': True})

    @action(detail=True, methods=['post'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        perfil = self.get_object()
        if perfil.user.is_superuser:
            raise ValidationError('No se puede desactivar al usuario master.')
        if perfil.user == request.user:
            raise ValidationError('No podés desactivarte a vos mismo.')
        estado_antes = perfil.activo
        perfil.activo = not perfil.activo
        perfil.save()
        _log(request, perfil.id, RegistroAuditoria.Accion.EDITAR,
             datos_antes={'activo': estado_antes, 'usuario': perfil.user.username},
             datos_despues={'activo': perfil.activo, 'usuario': perfil.user.username})
        return Response(PerfilUsuarioSerializer(perfil).data)

    @action(detail=True, methods=['post'], url_path='resetear-password')
    def resetear_password(self, request, pk=None):
        perfil = self.get_object()
        nueva = request.data.get('nueva_password', '')
        if len(nueva) < 8:
            raise ValidationError('La contraseña debe tener al menos 8 caracteres.')
        if perfil.user.check_password(nueva):
            raise ValidationError('La nueva contraseña no puede ser igual a la actual.')
        perfil.user.set_password(nueva)
        perfil.user.save()
        _log(request, perfil.id, RegistroAuditoria.Accion.EDITAR,
             datos_antes={'contraseña': '***'},
             datos_despues={'contraseña': f'*** (reseteada por administrador: {request.user.username})'})
        return Response({'ok': True})
