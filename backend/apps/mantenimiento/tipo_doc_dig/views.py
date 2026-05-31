from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from .models import TipoDocDigital
from .serializers import TipoDocDigitalListSerializer, TipoDocDigitalSerializer


class TipoDocDigitalViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = TipoDocDigital.objects.filter(is_deleted=False)
    serializer_class = TipoDocDigitalSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descripcion", "storage_key"]
    ordering_fields = ["descripcion", "storage_key"]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve', 'eliminados'):
            return TipoDocDigitalListSerializer
        return TipoDocDigitalSerializer

    def perform_destroy(self, instance):
        if (instance.documentos.filter(is_deleted=False).exists() or
                instance.documentos_prestador.filter(is_deleted=False).exists()):
            raise ValidationError('No se puede eliminar: tiene documentos activos vinculados.')
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = TipoDocDigital.objects.filter(is_deleted=True).order_by('descripcion')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
