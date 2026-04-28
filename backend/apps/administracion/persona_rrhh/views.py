from datetime import date
from django.template.loader import render_to_string
from django.http import HttpResponse
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.administracion.persona.models import Persona
from apps.administracion.persona.serializers import PersonaListSerializer
from config.pagination import StandardPagination
from .models import PersonaRRHH
from .serializers import PersonaRRHHSerializer, PersonaRRHHListSerializer


class PersonaRRHHViewSet(AuditoriaMixin, viewsets.ModelViewSet):
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
        if self.action in ["list", "retrieve", "eliminados", "buscar"]:
            return PersonaRRHHListSerializer
        return PersonaRRHHSerializer

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
                "No se puede eliminar un prestador con turnos activos. "
                "Primero cancelá o finalizá todos sus turnos."
            )
        instance.especialidades.clear()
        super().perform_destroy(instance)

    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = PersonaRRHH.objects.filter(
            is_deleted=True
        ).select_related("persona").prefetch_related("especialidades")
        return Response(PersonaRRHHListSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"], url_path="buscar")
    def buscar(self, request):
        nro_documento = request.query_params.get("nro_documento")
        if not nro_documento:
            return Response({"error": "nro_documento es requerido"}, status=400)
        try:
            persona      = Persona.objects.get(nro_documento=nro_documento, is_deleted=False)
            persona_data = PersonaListSerializer(persona).data
            try:
                prestador      = PersonaRRHH.objects.get(persona=persona, is_deleted=False)
                prestador_data = PersonaRRHHListSerializer(prestador).data
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

    @action(detail=False, methods=["get"], url_path="validar-matricula")
    def validar_matricula(self, request):
        nro        = request.query_params.get("nro_matricula", "").strip()
        exclude_id = request.query_params.get("exclude_id")
        if not nro:
            return Response({"disponible": True})
        qs = PersonaRRHH.objects.filter(nro_matricula=nro, is_deleted=False)
        if exclude_id:
            qs = qs.exclude(id=exclude_id)
        return Response({"disponible": not qs.exists()})

    @action(detail=False, methods=["get"], url_path="reporte-lista",
            permission_classes=[IsAuthenticated])
    def reporte_lista(self, request):
        prestadores = (
            PersonaRRHH.objects
            .filter(is_deleted=False)
            .select_related("persona")
            .prefetch_related("especialidades")
            .order_by("persona__razon_social")
        )
        CARGO_LABEL = {
            "medico": "Médico", "enfermero": "Enfermero/a",
            "administrativo": "Administrativo", "tecnico": "Técnico", "otro": "Otro",
        }
        filas = [
            {
                "nro":          i,
                "nombre":       p.persona.razon_social,
                "documento":    p.persona.nro_documento,
                "cargo":        CARGO_LABEL.get(p.cargo, p.cargo),
                "especialidades": ", ".join(e.descripcion for e in p.especialidades.all()) or "—",
                "matricula":    p.nro_matricula or "—",
                "estado":       p.get_estado_display(),
            }
            for i, p in enumerate(prestadores, start=1)
        ]
        hoy      = date.today()
        contexto = {"filas": filas, "fecha": hoy, "total": len(filas)}
        html     = render_to_string("informes/prestador_lista.html", contexto, request=request)
        try:
            import weasyprint
            pdf_bytes = weasyprint.HTML(
                string=html, base_url=request.build_absolute_uri("/")
            ).write_pdf()
        except Exception as e:
            return HttpResponse(f"Error generando PDF: {e}", status=500)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'inline; filename="listado_prestadores.pdf"'
        return response
