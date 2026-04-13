from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import PacienteResponsable
from .serializers import PacienteResponsableSerializer, PacienteResponsableListSerializer
from apps.persona.models import Persona
from apps.persona.serializers import PersonaSerializer
from config.pagination import StandardPagination
from drf_spectacular.utils import extend_schema, OpenApiParameter


class PacienteResponsableViewSet(viewsets.ModelViewSet):
    pagination_class  = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends   = [filters.SearchFilter, filters.OrderingFilter]
    search_fields     = ["persona__razon_social", "persona__nro_documento"]
    ordering_fields   = ["persona__razon_social", "fecha_creacion"]

    def get_queryset(self):
        return PacienteResponsable.objects.filter(
            is_deleted=False
        ).select_related(
            "persona__tipo_documento",
            "persona__pais",
            "persona__departamento",
            "persona__ciudad",
        )

    def get_serializer_class(self):
        if self.action in ["list", "retrieve"]:
            return PacienteResponsableListSerializer
        return PacienteResponsableSerializer

    # Auditoría
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # Borrado lógico con validación de dependencia
    def perform_destroy(self, instance):
        # Importación local para evitar importación circular con apps.principal.paciente
        from apps.principal.paciente.models import Paciente
        pacientes_activos = Paciente.objects.filter(
            responsable=instance, is_deleted=False
        ).count()
        if pacientes_activos > 0:
            raise ValidationError(
                f"No se puede eliminar: tiene {pacientes_activos} paciente(s) vinculado(s) activo(s)."
            )
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = PacienteResponsable.objects.filter(
            is_deleted=True
        ).select_related("persona")
        serializer = PacienteResponsableListSerializer(qs, many=True)
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
                responsable = PacienteResponsable.objects.get(persona=persona, is_deleted=False)
                responsable_data = PacienteResponsableSerializer(responsable).data
                es_responsable   = True
            except PacienteResponsable.DoesNotExist:
                responsable_data = None
                es_responsable   = False
            return Response({
                "persona":          persona_data,
                "pacienteresponsable": responsable_data,
                "es_responsable":   es_responsable,
            })
        except Persona.DoesNotExist:
            return Response(
                {"persona": None, "pacienteresponsable": None, "es_responsable": False},
                status=200,
            )
