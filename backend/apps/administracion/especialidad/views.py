from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import Especialidad
from .serializers import EspecialidadSerializer


class EspecialidadViewSet(viewsets.ModelViewSet):
    # Solo muestra especialidades activas (no eliminadas lógicamente)
    queryset = Especialidad.objects.filter(is_deleted=False)
    serializer_class = EspecialidadSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descripcion"]
    # Bug #4 corregido: el campo es "descripcion", no "especialidad"
    ordering_fields = ["descripcion"]

    # ── Auditoría ─────────────────────────────────────────────
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # ── Borrado lógico ────────────────────────────────────────
    def perform_destroy(self, instance):
        # Importación local para evitar importación circular
        from apps.principal.persona_rrhh.models import PersonaRRHH
        prestadores_activos = PersonaRRHH.objects.filter(
            especialidades=instance, is_deleted=False
        ).count()
        if prestadores_activos > 0:
            raise ValidationError(
                f"No se puede eliminar: {prestadores_activos} prestador(es) tienen esta especialidad asignada."
            )
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # ── Endpoint para ver registros eliminados ─────────────────
    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = Especialidad.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
