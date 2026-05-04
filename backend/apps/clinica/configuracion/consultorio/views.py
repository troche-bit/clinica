from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from .models import Consultorio
from .serializers import ConsultorioListSerializer, ConsultorioSerializer


class ConsultorioViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset         = Consultorio.objects.filter(is_deleted=False)
    serializer_class = ConsultorioSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ['nro_consultorio', 'descripcion']
    ordering_fields  = ['nro_consultorio']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return ConsultorioListSerializer
        return ConsultorioSerializer

    def perform_destroy(self, instance):
        if instance.horarios.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: tiene horarios de prestador activos.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Consultorio.objects.filter(is_deleted=True)
        return Response(ConsultorioListSerializer(qs, many=True).data)
