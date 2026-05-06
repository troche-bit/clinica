from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from .models import Agenda
from .serializers import AgendaSerializer, AgendaListSerializer
from config.pagination import StandardPagination
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import (
    IsAdminRole,
    IsAdminOrRecepcionista,
    IsAdminOrRecepcionistaOrSecretaria,
)


class AgendaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    filter_backends  = [filters.OrderingFilter]
    ordering_fields  = ['fecha', 'hora_desde']
    ordering         = ['fecha', 'hora_desde']

    def get_permissions(self):
        if self.action in (
            'list', 'retrieve', 'resumen_mes', 'stats_hoy',
            'asignar', 'cambiar_estado', 'reagendar',
        ):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionistaOrSecretaria()]

    def get_queryset(self):
        qs = Agenda.objects.filter(is_deleted=False).select_related(
            'horario_prestador__persona_rrhh__persona',
            'horario_prestador__persona_rrhh__persona__tipo_documento',
            'horario_prestador__persona_rrhh__persona__pais',
            'horario_prestador__persona_rrhh__persona__departamento',
            'horario_prestador__persona_rrhh__persona__ciudad',
            'horario_prestador__dia_semana',
            'paciente__persona',
        ).prefetch_related(
            'horario_prestador__especialidades',
        )

        rol               = self.request.auth.get('rol')                   if self.request.auth else None
        persona_rrhh_id   = self.request.auth.get('persona_rrhh_id')       if self.request.auth else None
        medicos_asignados = self.request.auth.get('medicos_asignados', []) if self.request.auth else []

        if rol == 'medico':
            if not persona_rrhh_id:
                return qs.none()
            return qs.filter(horario_prestador__persona_rrhh_id=persona_rrhh_id)

        if rol == 'secretaria_medico':
            if not medicos_asignados:
                return qs.none()
            return qs.filter(horario_prestador__persona_rrhh_id__in=medicos_asignados)

        params = self.request.query_params

        persona_rrhh = params.get('persona_rrhh')
        fecha        = params.get('fecha')
        fecha_desde  = params.get('fecha_desde')
        fecha_hasta  = params.get('fecha_hasta')
        estado       = params.get('estado')
        especialidad = params.get('especialidad')

        if persona_rrhh: qs = qs.filter(horario_prestador__persona_rrhh_id=persona_rrhh)
        if fecha:        qs = qs.filter(fecha=fecha)
        if fecha_desde:  qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:  qs = qs.filter(fecha__lte=fecha_hasta)
        if estado:       qs = qs.filter(estado=estado)
        if especialidad: qs = qs.filter(horario_prestador__especialidades__id=especialidad)

        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve', 'eliminados']:
            return AgendaListSerializer
        return AgendaSerializer

    def perform_destroy(self, instance):
        from apps.clinica.consultas.models import Consulta
        if Consulta.objects.filter(agenda=instance, is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: el turno tiene consultas registradas.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Agenda.objects.filter(is_deleted=True).select_related(
            'horario_prestador__persona_rrhh__persona',
            'horario_prestador__persona_rrhh__persona__tipo_documento',
            'horario_prestador__persona_rrhh__persona__pais',
            'horario_prestador__persona_rrhh__persona__departamento',
            'horario_prestador__persona_rrhh__persona__ciudad',
            'horario_prestador__dia_semana',
            'paciente__persona',
        ).prefetch_related(
            'horario_prestador__especialidades',
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['patch'], url_path='asignar')
    def asignar(self, request, pk=None):
        turno = self.get_object()

        if turno.estado != Agenda.Estado.DISPONIBLE:
            raise ValidationError(
                {'estado': 'Solo se puede asignar un turno disponible. Estado actual: ' + turno.estado + '.'}
            )

        paciente_id = request.data.get('paciente_id')
        if not paciente_id:
            raise ValidationError({'paciente_id': 'Requerido.'})

        from apps.clinica.paciente.models import Paciente
        try:
            paciente = Paciente.objects.get(id=paciente_id, is_deleted=False)
        except Paciente.DoesNotExist:
            raise ValidationError({'paciente_id': 'Paciente no encontrado.'})

        turno.paciente           = paciente
        turno.observacion        = request.data.get('observacion', turno.observacion)
        turno.estado             = Agenda.Estado.OCUPADO
        turno.id_usu_modificator = request.user
        turno.save()

        return Response(AgendaListSerializer(turno).data)

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
            valores = ', '.join(sorted(permitidos))
            raise ValidationError(
                {'estado': 'Valores permitidos: ' + valores + '. Para asignar use /asignar/.'}
            )

        if nuevo == Agenda.Estado.INACTIVO and turno.estado in [
            Agenda.Estado.OCUPADO, Agenda.Estado.REALIZADO
        ]:
            raise ValidationError(
                {'estado': 'No se puede inactivar un turno ocupado o realizado.'}
            )

        if nuevo == Agenda.Estado.REALIZADO and turno.estado != Agenda.Estado.OCUPADO:
            raise ValidationError(
                {'estado': 'Solo se puede marcar como realizado un turno con paciente asignado (ocupado).'}
            )

        if nuevo in [Agenda.Estado.CANCELADO, Agenda.Estado.DISPONIBLE] and turno.paciente:
            turno.paciente = None

        turno.estado             = nuevo
        turno.id_usu_modificator = request.user
        turno.save()

        return Response(AgendaListSerializer(turno).data)

    @action(detail=True, methods=['patch'], url_path='reagendar')
    def reagendar(self, request, pk=None):
        turno_actual = self.get_object()

        if turno_actual.estado != Agenda.Estado.OCUPADO:
            raise ValidationError({'estado': 'Solo se puede reagendar un turno ocupado.'})

        nuevo_turno_id = request.data.get('nuevo_turno_id')
        if not nuevo_turno_id:
            raise ValidationError({'nuevo_turno_id': 'Requerido.'})

        try:
            nuevo_turno = Agenda.objects.get(id=nuevo_turno_id, is_deleted=False)
        except Agenda.DoesNotExist:
            raise ValidationError({'nuevo_turno_id': 'Turno no encontrado.'})

        if nuevo_turno.estado != Agenda.Estado.DISPONIBLE:
            raise ValidationError({'nuevo_turno_id': 'El nuevo turno debe estar disponible.'})

        if nuevo_turno.horario_prestador.persona_rrhh_id != turno_actual.horario_prestador.persona_rrhh_id:
            raise ValidationError({'nuevo_turno_id': 'El nuevo turno debe pertenecer al mismo prestador.'})

        with transaction.atomic():
            paciente    = turno_actual.paciente
            observacion = turno_actual.observacion

            turno_actual.paciente           = None
            turno_actual.estado             = Agenda.Estado.CANCELADO
            turno_actual.id_usu_modificator = request.user
            turno_actual.save()

            nuevo_turno.paciente           = paciente
            nuevo_turno.estado             = Agenda.Estado.OCUPADO
            nuevo_turno.observacion        = observacion
            nuevo_turno.id_usu_modificator = request.user
            nuevo_turno.save()

        return Response({
            'turno_liberado':   AgendaListSerializer(turno_actual).data,
            'turno_reagendado': AgendaListSerializer(nuevo_turno).data,
        })

    @action(detail=False, methods=['post'], url_path='cancelar-rango')
    def cancelar_rango(self, request):
        persona_rrhh_id = request.data.get('persona_rrhh')
        fecha_desde_s   = request.data.get('fecha_desde')
        fecha_hasta_s   = request.data.get('fecha_hasta')

        if not all([persona_rrhh_id, fecha_desde_s, fecha_hasta_s]):
            return Response(
                {'error': 'persona_rrhh, fecha_desde y fecha_hasta son requeridos.'},
                status=400,
            )

        qs = self.get_queryset().filter(
            horario_prestador__persona_rrhh_id=persona_rrhh_id,
            fecha__gte=fecha_desde_s,
            fecha__lte=fecha_hasta_s,
            estado=Agenda.Estado.DISPONIBLE,
        )

        count = qs.count()
        qs.update(
            estado=Agenda.Estado.CANCELADO,
            id_usu_modificator_id=request.user.pk,
        )

        return Response({'cancelados': count})

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
                'fecha':       str(r['fecha']),
                'disponibles': r['disponibles'],
                'ocupados':    r['ocupados'],
                'inactivos':   r['inactivos'],
                'cancelados':  r['cancelados'],
                'total':       r['total'],
            }
            for r in qs
        ])

    @action(detail=False, methods=['get'], url_path='stats-hoy')
    def stats_hoy(self, request):
        hoy = timezone.localtime().date()
        qs  = Agenda.objects.filter(fecha=hoy, is_deleted=False)
        return Response({
            'total':       qs.count(),
            'confirmadas': qs.filter(estado=Agenda.Estado.OCUPADO).count(),
            'pendientes':  qs.filter(estado=Agenda.Estado.DISPONIBLE).count(),
            'realizadas':  qs.filter(estado=Agenda.Estado.REALIZADO).count(),
            'inactivos':   qs.filter(estado=Agenda.Estado.INACTIVO).count(),
            'cancelados':  qs.filter(estado=Agenda.Estado.CANCELADO).count(),
        })
