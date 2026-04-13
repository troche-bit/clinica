from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, MethodNotAllowed
from django.utils import timezone
from drf_spectacular.utils import extend_schema, OpenApiParameter
# Importamos con la nueva ruta tras mover paciente a apps/principal/
from apps.principal.paciente.models import Paciente
from apps.principal.paciente.serializers import PacienteSerializer
from apps.principal.paciente_responsable.models import PacienteResponsable
from .models import TipoDocumento, Persona
from .serializers import TipoDocumentoSerializer, PersonaSerializer


class TipoDocumentoViewSet(viewsets.ModelViewSet):
    # Bug C corregido: filtramos is_deleted=False y agregamos auditoría
    queryset = TipoDocumento.objects.filter(is_deleted=False)
    serializer_class = TipoDocumentoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ["descripcion"]

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        # Verificar que no existan personas con este tipo de documento
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError(
                "No se puede eliminar: existen personas con este tipo de documento."
            )
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()


class PersonaViewSet(viewsets.ModelViewSet):
    serializer_class = PersonaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["razon_social", "nro_documento", "correo_electronico"]
    ordering_fields = ["razon_social", "fecha_creacion"]

    def get_queryset(self):
        return Persona.objects.filter(
            is_deleted=False
        ).select_related("tipo_documento", "pais", "departamento", "ciudad")

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        # Bug B corregido: Persona no puede eliminarse ni lógica ni físicamente.
        # Es un registro de identidad compartido por paciente, responsable y en el futuro prestador.
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
            serializer = PersonaSerializer(persona)
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
