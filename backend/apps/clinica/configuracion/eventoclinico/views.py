from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from .models import EventoClinico
from .serializers import EventoClinicoListSerializer, EventoClinicoSerializer


class EventoClinicoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = EventoClinico.objects.filter(is_deleted=False)
    serializer_class = EventoClinicoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tipo_evento']
    ordering_fields = ['tipo_evento']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return EventoClinicoListSerializer
        return EventoClinicoSerializer

    def perform_destroy(self, instance):
        if instance.consultas.filter(is_deleted=False).exists():
            raise ValidationError(
                'No se puede eliminar: el evento clínico tiene consultas activas vinculadas.'
            )
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = EventoClinico.objects.filter(is_deleted=True).order_by('tipo_evento')
        return Response(EventoClinicoListSerializer(qs, many=True).data)
