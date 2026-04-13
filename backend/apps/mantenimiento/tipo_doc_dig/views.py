from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import TipoDocDigital
from .serializers import TipoDocDigitalSerializer


class TipoDocDigitalViewSet(viewsets.ModelViewSet):
    # Solo muestra registros activos (no eliminados lógicamente)
    queryset = TipoDocDigital.objects.filter(is_deleted=False)
    serializer_class = TipoDocDigitalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descripcion", "storage_key"]
    ordering_fields = ["descripcion", "storage_key"]

    # ── Auditoría ─────────────────────────────────────────────
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # ── Borrado lógico ────────────────────────────────────────
    def perform_destroy(self, instance):
        # PENDIENTE: cuando se implemente Documentos Digitalizados, verificar
        # que no existan documentos activos de este tipo antes de eliminar.
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # ── Endpoint para ver registros eliminados ─────────────────
    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = TipoDocDigital.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
