from datetime import date
from django.template.loader import render_to_string
from django.http import HttpResponse
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from apps.administracion.persona.models import Persona
from apps.administracion.persona.serializers import PersonaListSerializer
from .models import PacienteResponsable
from .serializers import PacienteResponsableSerializer, PacienteResponsableListSerializer
from config.pagination import StandardPagination


class PacienteResponsableViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ["persona__razon_social", "persona__nro_documento"]
    ordering_fields  = ["persona__razon_social", "fecha_creacion"]

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'buscar'):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

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
        if self.action in ["list", "retrieve", "eliminados"]:
            return PacienteResponsableListSerializer
        return PacienteResponsableSerializer

    def perform_destroy(self, instance):
        from apps.clinica.paciente.models import Paciente
        activos = Paciente.objects.filter(responsable=instance, is_deleted=False).count()
        if activos > 0:
            raise ValidationError(
                f"No se puede eliminar: tiene {activos} paciente(s) vinculado(s) activo(s)."
            )
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = PacienteResponsable.objects.filter(is_deleted=True).select_related(
            "persona__tipo_documento",
            "persona__pais",
            "persona__departamento",
            "persona__ciudad",
        )
        return Response(PacienteResponsableListSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="buscar")
    def buscar(self, request):
        nro_documento = request.query_params.get("nro_documento")
        if not nro_documento:
            return Response({"error": "nro_documento es requerido"}, status=400)
        try:
            persona = Persona.objects.select_related(
                "tipo_documento", "pais", "departamento", "ciudad"
            ).get(nro_documento=nro_documento, is_deleted=False)
            persona_data = PersonaListSerializer(persona).data
            try:
                responsable = PacienteResponsable.objects.select_related(
                    "persona__tipo_documento",
                    "persona__pais",
                    "persona__departamento",
                    "persona__ciudad",
                ).get(persona=persona, is_deleted=False)
                responsable_data = PacienteResponsableListSerializer(responsable).data
                es_responsable   = True
            except PacienteResponsable.DoesNotExist:
                responsable_data = None
                es_responsable   = False
            return Response({
                "persona":             persona_data,
                "pacienteresponsable": responsable_data,
                "es_responsable":      es_responsable,
            })
        except Persona.DoesNotExist:
            return Response(
                {"persona": None, "pacienteresponsable": None, "es_responsable": False},
                status=200,
            )

    @action(detail=False, methods=["get"], url_path="reporte-lista")
    def reporte_lista(self, request):
        responsables = (
            PacienteResponsable.objects
            .filter(is_deleted=False)
            .select_related("persona")
            .order_by("persona__razon_social")
        )
        filas = [
            {
                "nro":                 i,
                "nombre":              r.persona.razon_social,
                "documento":           r.persona.nro_documento,
                "telefono":            r.persona.telefono or "—",
                "ocupacion":           r.ocupacion or "—",
                "contacto_emergencia": "Sí" if r.es_contacto_emergencia else "No",
                "observacion":         r.observacion or "—",
            }
            for i, r in enumerate(responsables, start=1)
        ]
        hoy      = date.today()
        contexto = {"filas": filas, "fecha": hoy, "total": len(filas)}
        html     = render_to_string("informes/responsable_lista.html", contexto, request=request)
        try:
            import weasyprint
            pdf_bytes = weasyprint.HTML(
                string=html, base_url=request.build_absolute_uri("/")
            ).write_pdf()
        except Exception as e:
            return HttpResponse(f"Error generando PDF: {e}", status=500)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'inline; filename="listado_responsables.pdf"'
        return response
