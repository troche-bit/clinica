from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from apps.administracion.auditoria.mixins import AuditoriaMixin
from .models import Consultorio
from .serializers import ConsultorioListSerializer, ConsultorioSerializer


class ConsultorioViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = Consultorio.objects.filter(is_deleted=False)
    serializer_class = ConsultorioSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nro_consultorio', 'descripcion']
    ordering_fields = ['nro_consultorio']

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return ConsultorioListSerializer
        return ConsultorioSerializer

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Consultorio.objects.filter(is_deleted=True)
        serializer = ConsultorioListSerializer(qs, many=True)
        return Response(serializer.data)
