from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import EventoClinico
from .serializers import EventoClinicoSerializer


class EventoClinicoViewSet(viewsets.ModelViewSet):
    # Solo muestra eventos clínicos activos (no eliminados lógicamente)
    queryset = EventoClinico.objects.filter(is_deleted=False)
    serializer_class = EventoClinicoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["tipo_evento"]
    ordering_fields = ["tipo_evento"]

    # ── Auditoría ─────────────────────────────────────────────
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # ── Borrado lógico ────────────────────────────────────────
    def perform_destroy(self, instance):
        # Nota: actualmente ningún modelo tiene FK a EventoClinico.
        # Si en el futuro se agrega una relación, agregar el check de dependencias aquí.
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # ── Endpoint para ver registros eliminados ─────────────────
    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = EventoClinico.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
