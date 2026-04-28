from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from .models import EventoClinico
from .serializers import EventoClinicoListSerializer, EventoClinicoSerializer


class EventoClinicoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = EventoClinico.objects.filter(is_deleted=False)
    serializer_class = EventoClinicoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['tipo_evento']
    ordering_fields = ['tipo_evento']

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
        qs = EventoClinico.objects.filter(is_deleted=True)
        serializer = EventoClinicoListSerializer(qs, many=True)
        return Response(serializer.data)
