from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import Paciente
from .serializers import PacienteSerializer, PacienteListSerializer
from config.pagination import StandardPagination


class PacienteViewSet(viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["persona__razon_social", "persona__nro_documento"]
    ordering_fields    = ["persona__razon_social", "fecha_creacion"]

    def get_queryset(self):
        return Paciente.objects.filter(
            is_deleted=False
        ).select_related(
            "persona__tipo_documento",
            "persona__pais",
            "persona__departamento",
            "persona__ciudad",
            "responsable__persona",
        )

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return PacienteListSerializer
        return PacienteSerializer

    # Auditoría
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # Borrado lógico — solo desvincula al paciente, no toca Persona
    def perform_destroy(self, instance):
        from apps.principal.agenda.models import Agenda
        tiene_citas = Agenda.objects.filter(
            paciente=instance,
            is_deleted=False,
            estado__in=[
                Agenda.Estado.DISPONIBLE,
                Agenda.Estado.OCUPADO,
                Agenda.Estado.REALIZADO,
            ],
        ).exists()
        if tiene_citas:
            raise ValidationError(
                'No se puede eliminar un paciente con citas activas (disponible, ocupado o realizado). '
                'Primero cancelá o finalizá todas sus citas.'
            )
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = Paciente.objects.filter(is_deleted=True).select_related("persona")
        serializer = PacienteListSerializer(qs, many=True)
        return Response(serializer.data)
