from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import PersonaRRHH
from .serializers import PersonaRRHHSerializer, PersonaRRHHListSerializer
from apps.persona.models import Persona
from apps.persona.serializers import PersonaSerializer
from config.pagination import StandardPagination
from drf_spectacular.utils import extend_schema, OpenApiParameter


class PersonaRRHHViewSet(viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ["persona__razon_social", "persona__nro_documento", "nro_matricula"]
    ordering_fields    = ["persona__razon_social", "cargo", "estado", "fecha_creacion"]

    def get_queryset(self):
        return PersonaRRHH.objects.filter(
            is_deleted=False
        ).select_related(
            "persona__tipo_documento",
            "persona__pais",
            "persona__departamento",
            "persona__ciudad",
        ).prefetch_related("especialidades")

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return PersonaRRHHListSerializer
        return PersonaRRHHSerializer

    # Auditoría
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # Borrado lógico — solo desvincula al prestador, no toca Persona
    def perform_destroy(self, instance):
        from apps.principal.agenda.models import Agenda
        tiene_turnos = Agenda.objects.filter(
            horario_prestador__persona_rrhh=instance,
            is_deleted=False,
            estado__in=[
                Agenda.Estado.DISPONIBLE,
                Agenda.Estado.OCUPADO,
                Agenda.Estado.REALIZADO,
            ],
        ).exists()
        if tiene_turnos:
            raise ValidationError(
                'No se puede eliminar un prestador con turnos activos (disponible, ocupado o realizado). '
                'Primero cancelá o finalizá todos sus turnos.'
            )
        # Limpia los vínculos M2M antes del borrado lógico.
        # La tabla intermedia no tiene soft delete — se eliminan físicamente.
        # Si el registro se reactiva, las especialidades se reasignan manualmente.
        instance.especialidades.clear()
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = PersonaRRHH.objects.filter(
            is_deleted=True
        ).select_related("persona").prefetch_related("especialidades")
        serializer = PersonaRRHHListSerializer(qs, many=True)
        return Response(serializer.data)

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="nro_documento",
                type=str,
                description="Número de documento a buscar",
                required=True,
            )
        ]
    )
    @action(detail=False, methods=["get"], url_path="buscar")
    def buscar(self, request):
        nro_documento = request.query_params.get("nro_documento")
        if not nro_documento:
            return Response({"error": "nro_documento es requerido"}, status=400)
        try:
            persona = Persona.objects.get(nro_documento=nro_documento, is_deleted=False)
            persona_data = PersonaSerializer(persona).data
            try:
                prestador = PersonaRRHH.objects.get(persona=persona, is_deleted=False)
                prestador_data = PersonaRRHHSerializer(prestador).data
                es_prestador   = True
            except PersonaRRHH.DoesNotExist:
                prestador_data = None
                es_prestador   = False
            return Response({
                "persona":      persona_data,
                "personarrhh":  prestador_data,
                "es_prestador": es_prestador,
            })
        except Persona.DoesNotExist:
            return Response(
                {"persona": None, "personarrhh": None, "es_prestador": False},
                status=200,
            )
