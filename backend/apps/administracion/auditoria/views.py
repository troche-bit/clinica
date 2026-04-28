from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from .models import RegistroAuditoria
from .serializers import RegistroAuditoriaSerializer


class RegistroAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class   = RegistroAuditoriaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['tabla', 'accion', 'usuario__username']
    ordering_fields    = ['fecha', 'tabla', 'accion']
    ordering           = ['-fecha']

    def get_queryset(self):
        # Solo administradores pueden ver los registros de auditoría
        try:
            rol = self.request.user.perfil.rol
        except Exception:
            rol = None
        if rol != 'admin':
            raise PermissionDenied('Solo los administradores pueden acceder al registro de auditoría.')

        qs = RegistroAuditoria.objects.select_related('usuario').all()

        tabla   = self.request.query_params.get('tabla')
        accion  = self.request.query_params.get('accion')
        usuario = self.request.query_params.get('usuario')
        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')

        if tabla:
            qs = qs.filter(tabla__icontains=tabla)
        if accion:
            qs = qs.filter(accion=accion.upper())
        if usuario:
            qs = qs.filter(usuario__username__icontains=usuario)
        if fecha_desde:
            qs = qs.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__date__lte=fecha_hasta)

        return qs