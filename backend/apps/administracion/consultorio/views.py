from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Consultorio
from .serializers import ConsultorioSerializer


class ConsultorioViewSet(viewsets.ModelViewSet):
    # Solo registros activos (no eliminados logicamente)
    queryset = Consultorio.objects.filter(is_deleted=False)
    serializer_class = ConsultorioSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["nro_consultorio"]
    ordering_fields = ["nro_consultorio"]

    # Auditoria: registra el usuario que crea el consultorio
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    # Auditoria: registra el usuario que modifica el consultorio
    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # Borrado logico: marca el registro como eliminado sin borrarlo fisicamente.
    # PENDIENTE: cuando se implemente el módulo de Citas/Appointments agregar aquí
    # la verificación de dependencias activas, por ejemplo:
    #   if instance.citas.filter(is_deleted=False).exists():
    #       raise ValidationError('No se puede eliminar: el consultorio tiene citas activas.')
    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # Endpoint adicional: lista los consultorios eliminados logicamente
    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = Consultorio.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
