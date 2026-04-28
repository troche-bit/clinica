from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from .models import Especialidad
from .serializers import EspecialidadListSerializer, EspecialidadSerializer


class EspecialidadViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = Especialidad.objects.filter(is_deleted=False)
    serializer_class = EspecialidadSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion']
    ordering_fields = ['descripcion']

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return EspecialidadListSerializer
        return EspecialidadSerializer

    def perform_destroy(self, instance):
        from apps.administracion.persona_rrhh.models import PersonaRRHH
        activos = PersonaRRHH.objects.filter(especialidades=instance, is_deleted=False).count()
        if activos > 0:
            raise ValidationError(
                f'No se puede eliminar: {activos} prestador(es) tienen esta especialidad asignada.'
            )
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Especialidad.objects.filter(is_deleted=True)
        serializer = EspecialidadListSerializer(qs, many=True)
        return Response(serializer.data)
