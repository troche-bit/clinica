from datetime import date
from django.db.models import Count, Q
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import Consulta
from .serializers import ConsultaSerializer, ConsultaListSerializer
from config.pagination import StandardPagination


class ConsultaViewSet(viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['agenda__fecha', 'hora_desde']
    ordering           = ['-agenda__fecha', 'hora_desde']

    def get_queryset(self):
        qs = Consulta.objects.filter(is_deleted=False).select_related(
            'agenda__horario_prestador__persona_rrhh__persona',
            'agenda__paciente__persona',
            'agenda__paciente__responsable__persona',
            'evento_clinico',
        ).prefetch_related(
            'agenda__horario_prestador__especialidades',
        )

        params = self.request.query_params

        persona_rrhh = params.get('persona_rrhh')
        fecha        = params.get('fecha')
        estado       = params.get('estado')
        paciente     = params.get('paciente')

        if persona_rrhh:
            qs = qs.filter(agenda__horario_prestador__persona_rrhh_id=persona_rrhh)
        if fecha:
            qs = qs.filter(agenda__fecha=fecha)
        if estado:
            qs = qs.filter(estado=estado)
        if paciente:
            qs = qs.filter(agenda__paciente_id=paciente)

        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return ConsultaListSerializer
        return ConsultaSerializer

    def perform_create(self, serializer):
        agenda = serializer.validated_data.get('agenda')

        # Validar que la agenda esté en estado 'ocupado'
        if agenda.estado != 'ocupado':
            raise ValidationError(
                {'agenda': f'Solo se puede crear una consulta para un turno ocupado. Estado actual: {agenda.estado}.'}
            )

        # Validar que no exista una consulta activa para esta agenda
        if Consulta.objects.filter(agenda=agenda, is_deleted=False).exists():
            raise ValidationError(
                {'agenda': 'Ya existe una consulta activa para este turno.'}
            )

        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted         = True
        instance.fecha_eliminacion  = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # ── POST /consultas/{id}/iniciar/ ────────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='iniciar')
    def iniciar(self, request, pk=None):
        consulta = self.get_object()

        if consulta.estado != Consulta.Estado.EN_ESPERA:
            raise ValidationError(
                {'estado': f'Solo se puede iniciar una consulta en espera. Estado actual: {consulta.estado}.'}
            )

        consulta.estado              = Consulta.Estado.EN_CONSULTA
        consulta.hora_desde          = timezone.now().time()
        consulta.id_usu_modificator  = request.user
        consulta.save()

        return Response(ConsultaListSerializer(consulta).data)

    # ── POST /consultas/{id}/finalizar/ ──────────────────────────────────────
    @action(detail=True, methods=['post'], url_path='finalizar')
    def finalizar(self, request, pk=None):
        consulta = self.get_object()

        if consulta.estado != Consulta.Estado.EN_CONSULTA:
            raise ValidationError(
                {'estado': f'Solo se puede finalizar una consulta en curso. Estado actual: {consulta.estado}.'}
            )

        consulta.estado              = Consulta.Estado.FINALIZADA
        consulta.hora_hasta          = timezone.now().time()
        consulta.id_usu_modificator  = request.user
        consulta.save()

        # Actualizar agenda a 'realizado'
        from apps.principal.agenda.models import Agenda
        agenda = consulta.agenda
        agenda.estado             = Agenda.Estado.REALIZADO
        agenda.id_usu_modificator = request.user
        agenda.save()

        return Response(ConsultaListSerializer(consulta).data)

    # ── GET /consultas/stats-hoy/ ─────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='stats-hoy')
    def stats_hoy(self, request):
        hoy = date.today()
        qs  = Consulta.objects.filter(agenda__fecha=hoy, is_deleted=False)
        return Response({
            'total':        qs.count(),
            'en_espera':    qs.filter(estado=Consulta.Estado.EN_ESPERA).count(),
            'en_consulta':  qs.filter(estado=Consulta.Estado.EN_CONSULTA).count(),
            'finalizadas':  qs.filter(estado=Consulta.Estado.FINALIZADA).count(),
        })
