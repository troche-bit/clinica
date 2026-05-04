from datetime import date, datetime, timedelta
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from .models import HorarioPrestador
from .serializers import HorarioPrestadorSerializer, HorarioPrestadorListSerializer
from config.pagination import StandardPagination


class HorarioPrestadorViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['dia_semana__id', 'hora_desde', 'fecha_creacion']

    def get_queryset(self):
        qs = HorarioPrestador.objects.filter(
            is_deleted=False,
            persona_rrhh__is_deleted=False,
        ).select_related(
            'persona_rrhh__persona',
            'dia_semana',
        ).prefetch_related(
            'especialidades',
        )
        persona_rrhh = self.request.query_params.get('persona_rrhh')
        estado       = self.request.query_params.get('estado')
        if persona_rrhh:
            qs = qs.filter(persona_rrhh_id=persona_rrhh)
        if estado:
            qs = qs.filter(estado=estado)
        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve', 'eliminados']:
            return HorarioPrestadorListSerializer
        return HorarioPrestadorSerializer

    def perform_destroy(self, instance):
        from apps.clinica.agenda.models import Agenda
        tiene_turnos = Agenda.objects.filter(
            horario_prestador=instance,
            is_deleted=False,
            estado__in=[
                Agenda.Estado.DISPONIBLE,
                Agenda.Estado.OCUPADO,
                Agenda.Estado.REALIZADO,
            ],
        ).exists()
        if tiene_turnos:
            raise ValidationError(
                'No se puede eliminar un horario con turnos activos (disponible, ocupado o realizado). '
                'Primero cancelá o finalizá todos sus turnos.'
            )
        instance.especialidades.clear()
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = HorarioPrestador.objects.filter(
            is_deleted=True
        ).select_related(
            'persona_rrhh__persona',
            'dia_semana',
        ).prefetch_related(
            'especialidades',
        )
        serializer = HorarioPrestadorListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='generar')
    def generar(self, request, pk=None):
        from apps.clinica.agenda.models import Agenda

        horario       = self.get_object()
        fecha_desde_s = request.data.get('fecha_desde')
        fecha_hasta_s = request.data.get('fecha_hasta')

        if not fecha_desde_s or not fecha_hasta_s:
            return Response(
                {'error': 'fecha_desde y fecha_hasta son requeridos.'},
                status=400,
            )
        try:
            fecha_desde = date.fromisoformat(fecha_desde_s)
            fecha_hasta = date.fromisoformat(fecha_hasta_s)
        except ValueError:
            return Response(
                {'error': 'Formato de fecha inválido. Use YYYY-MM-DD.'},
                status=400,
            )
        if fecha_hasta < fecha_desde:
            return Response(
                {'error': 'fecha_hasta debe ser mayor o igual a fecha_desde.'},
                status=400,
            )

        creados   = 0
        omitidos  = 0
        detalle   = []
        intervalo = timedelta(minutes=horario.intervalo)

        for i in range((fecha_hasta - fecha_desde).days + 1):
            fecha_actual = fecha_desde + timedelta(days=i)

            if horario.excepcion:
                if horario.fecha_excepcion != fecha_actual:
                    continue
            else:
                if horario.dia_semana.id != fecha_actual.weekday() + 1:
                    continue

            turnos_creados  = 0
            turnos_omitidos = 0
            hora_actual = datetime.combine(fecha_actual, horario.hora_desde)
            hora_limite = datetime.combine(fecha_actual, horario.hora_hasta)

            while hora_actual < hora_limite:
                hora_fin = hora_actual + intervalo

                existe = Agenda.objects.filter(
                    horario_prestador=horario,
                    fecha=fecha_actual,
                    hora_desde=hora_actual.time(),
                    is_deleted=False,
                ).exists()

                if not existe:
                    Agenda.objects.create(
                        horario_prestador = horario,
                        fecha             = fecha_actual,
                        hora_desde        = hora_actual.time(),
                        hora_hasta        = hora_fin.time(),
                        estado            = Agenda.Estado.DISPONIBLE,
                        id_usu_creator    = request.user,
                    )
                    turnos_creados += 1
                    creados        += 1
                else:
                    turnos_omitidos += 1
                    omitidos        += 1

                hora_actual += intervalo

            detalle.append({
                'fecha':           str(fecha_actual),
                'dia':             horario.dia_semana.descripcion,
                'turnos_creados':  turnos_creados,
                'turnos_omitidos': turnos_omitidos,
            })

        return Response({
            'creados':  creados,
            'omitidos': omitidos,
            'detalle':  detalle,
        })
