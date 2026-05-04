from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, MethodNotAllowed
from drf_spectacular.utils import extend_schema, OpenApiParameter
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from apps.clinica.paciente.models import Paciente
from apps.clinica.paciente.serializers import PacienteSerializer
from .models import TipoDocumento, Persona
from .serializers import TipoDocumentoSerializer, PersonaListSerializer, PersonaSerializer


class TipoDocumentoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = TipoDocumento.objects.filter(is_deleted=False)
    serializer_class = TipoDocumentoSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["descripcion"]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_destroy(self, instance):
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError(
                "No se puede eliminar: existen personas con este tipo de documento."
            )
        super().perform_destroy(instance)


class PersonaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    serializer_class = PersonaSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["razon_social", "nro_documento", "correo_electronico"]
    ordering_fields = ["razon_social", "fecha_creacion"]

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'buscar'):
            return [IsAuthenticated()]
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_queryset(self):
        return Persona.objects.filter(
            is_deleted=False
        ).select_related("tipo_documento", "pais", "departamento", "ciudad")

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve', 'buscar'):
            return PersonaListSerializer
        return PersonaSerializer

    def perform_destroy(self, instance):
        raise MethodNotAllowed(
            "DELETE",
            detail="Los datos de persona no pueden eliminarse. Eliminar el paciente o responsable vinculado."
        )

    @extend_schema(
        parameters=[
            OpenApiParameter(
                name="nro_documento",
                type=str,
                description="Número de documento a buscar",
                required=True
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
            serializer = PersonaListSerializer(persona)
            try:
                paciente = Paciente.objects.get(persona=persona, is_deleted=False)
                paciente_data = PacienteSerializer(paciente).data
                es_paciente = True
            except Paciente.DoesNotExist:
                paciente_data = None
                es_paciente = False
            return Response({
                "persona": serializer.data,
                "paciente": paciente_data,
                "es_paciente": es_paciente,
            })
        except Persona.DoesNotExist:
            return Response(
                {"persona": None, "paciente": None, "es_paciente": False},
                status=200
            )
