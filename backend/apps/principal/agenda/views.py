from datetime import date
from django.db.models import Count, Q
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import Agenda
from .serializers import AgendaSerializer, AgendaListSerializer
from config.pagination import StandardPagination


class AgendaViewSet(viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['fecha', 'hora_desde']
    ordering           = ['fecha', 'hora_desde']

    def get_queryset(self):
        qs = Agenda.objects.filter(is_deleted=False).select_related(
            'horario_prestador__persona_rrhh__persona',
            'horario_prestador__dia_semana',
            'paciente__persona',
        ).prefetch_related(
            'horario_prestador__especialidades',
        )

        params = self.request.query_params

        persona_rrhh = params.get('persona_rrhh')
        fecha        = params.get('fecha')
        fecha_desde  = params.get('fecha_desde')
        fecha_hasta  = params.get('fecha_hasta')
        estado       = params.get('estado')
        especialidad = params.get('especialidad')

        if persona_rrhh:
            qs = qs.filter(horario_prestador__persona_rrhh_id=persona_rrhh)
        if fecha:
            qs = qs.filter(fecha=fecha)
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)
        if estado:
            qs = qs.filter(estado=estado)
        if especialidad:
            qs = qs.filter(horario_prestador__especialidades__id=especialidad)

        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve']:
            return AgendaListSerializer
        return AgendaSerializer

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted     = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # ── PATCH /agenda/{id}/asignar/ ──────────────────────────────────────────
    @action(detail=True, methods=['patch'], url_path='asignar')
    def asignar(self, request, pk=None):
        turno = self.get_object()

        if turno.estado != Agenda.Estado.DISPONIBLE:
            raise ValidationError(
                {'estado': f'Solo se puede asignar un turno disponible. Estado actual: {turno.estado}.'}
            )

        paciente_id = request.data.get('paciente_id')
        if not paciente_id:
            raise ValidationError({'paciente_id': 'Requerido.'})

        from apps.clinica.paciente.models import Paciente
        try:
            paciente = Paciente.objects.get(id=paciente_id, is_deleted=False)
        except Paciente.DoesNotExist:
            raise ValidationError({'paciente_id': 'Paciente no encontrado.'})

        turno.paciente            = paciente
        turno.observacion         = request.data.get('observacion', turno.observacion)
        turno.estado              = Agenda.Estado.OCUPADO
        turno.id_usu_modificator  = request.user
        turno.save()

        return Response(AgendaListSerializer(turno).data)

    # ── PATCH /agenda/{id}/estado/ ───────────────────────────────────────────
    @action(detail=True, methods=['patch'], url_path='estado')
    def cambiar_estado(self, request, pk=None):
        turno     = self.get_object()
        nuevo     = request.data.get('estado')
        permitidos = {
            Agenda.Estado.DISPONIBLE,
            Agenda.Estado.INACTIVO,
            Agenda.Estado.CANCELADO,
            Agenda.Estado.REALIZADO,
        }

        if nuevo not in permitidos:
            raise ValidationError(
                {'estado': f'Valores permitidos: {", ".join(sorted(permitidos))}. Para asignar use /asignar/.'}
            )

        # No se puede inactivar un turno ocupado o realizado
        if nuevo == Agenda.Estado.INACTIVO and turno.estado in [
            Agenda.Estado.OCUPADO, Agenda.Estado.REALIZADO
        ]:
            raise ValidationError(
                {'estado': 'No se puede inactivar un turno ocupado o realizado.'}
            )

        # Solo se puede marcar como realizado si el turno tiene paciente asignado
        if nuevo == Agenda.Estado.REALIZADO and turno.estado != Agenda.Estado.OCUPADO:
            raise ValidationError(
                {'estado': 'Solo se puede marcar como realizado un turno con paciente asignado (ocupado).'}
            )

        # Al cancelar o liberar un turno con paciente, liberar el paciente
        if nuevo in [Agenda.Estado.CANCELADO, Agenda.Estado.DISPONIBLE] and turno.paciente:
            turno.paciente = None

        turno.estado             = nuevo
        turno.id_usu_modificator = request.user
        turno.save()

        return Response(AgendaListSerializer(turno).data)

    # ── GET /agenda/resumen-mes/ ──────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='resumen-mes')
    def resumen_mes(self, request):
        persona_rrhh = request.query_params.get('persona_rrhh')
        mes          = request.query_params.get('mes')
        anio         = request.query_params.get('anio')

        if not all([persona_rrhh, mes, anio]):
            return Response({'error': 'persona_rrhh, mes y anio son requeridos.'}, status=400)

        qs = Agenda.objects.filter(
            horario_prestador__persona_rrhh_id=persona_rrhh,
            fecha__month=mes,
            fecha__year=anio,
            is_deleted=False,
        ).values('fecha').annotate(
            disponibles=Count('id', filter=Q(estado='disponible')),
            ocupados   =Count('id', filter=Q(estado='ocupado')),
            inactivos  =Count('id', filter=Q(estado='inactivo')),
            cancelados =Count('id', filter=Q(estado='cancelado')),
            total      =Count('id'),
        ).order_by('fecha')

        return Response([
            {
                'fecha':      str(r['fecha']),
                'disponibles': r['disponibles'],
                'ocupados':    r['ocupados'],
                'inactivos':   r['inactivos'],
                'cancelados':  r['cancelados'],
                'total':       r['total'],
            }
            for r in qs
        ])

    # ── GET /agenda/stats-hoy/ ────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='stats-hoy')
    def stats_hoy(self, request):
        hoy = date.today()
        qs  = Agenda.objects.filter(fecha=hoy, is_deleted=False)
        return Response({
            'total':       qs.count(),
            'confirmadas': qs.filter(estado=Agenda.Estado.OCUPADO).count(),
            'pendientes':  qs.filter(estado=Agenda.Estado.DISPONIBLE).count(),
            'realizadas':  qs.filter(estado=Agenda.Estado.REALIZADO).count(),
            'inactivos':   qs.filter(estado=Agenda.Estado.INACTIVO).count(),
            'cancelados':  qs.filter(estado=Agenda.Estado.CANCELADO).count(),
        })
