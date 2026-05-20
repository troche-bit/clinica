import re
from datetime import date, timedelta

from django.db.models import Exists, OuterRef, Prefetch
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.clinica.consultas.models import Consulta
from apps.clinica.agenda.models import Agenda
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from .models import Notificacion, ConfiguracionNotificacion, PlantillaNotificacion
from .serializers import (
    NotificacionListSerializer,
    ConfiguracionNotificacionSerializer,
    PlantillaNotificacionListSerializer,
    PlantillaNotificacionSerializer,
)


PLANTILLAS = {
    'recordatorio_cita': (
        'Hola {nombre}, le recordamos que tiene una cita programada para el {fecha} '
        'con {medico} en Clínica Lichi.'
    ),
    'confirmacion_reserva': (
        'Hola {nombre}, su cita ha sido confirmada para el {fecha} a las {hora} '
        'con {medico} — {especialidad}. Clínica Lichi.'
    ),
    'indicaciones': (
        'Hola {nombre}, le enviamos las indicaciones de su consulta del {fecha}: '
        '{indicaciones}. Ante cualquier duda contáctenos.'
    ),
    'otro': '',
}


def _build_mensaje(tipo, consulta):
    tpl = PLANTILLAS.get(tipo, '')
    if not tpl:
        return ''

    paciente = consulta.agenda.paciente
    nombre   = paciente.persona.razon_social if paciente else '—'
    rrhh     = consulta.agenda.horario_prestador.persona_rrhh
    medico   = rrhh.persona.razon_social if rrhh else '—'
    esp_list = list(rrhh.especialidades.values_list('descripcion', flat=True)[:1]) if rrhh else []
    especialidad = esp_list[0] if esp_list else '—'

    return tpl.format(
        nombre=nombre,
        fecha=str(consulta.proxima_cita or consulta.agenda.fecha),
        hora=str(consulta.agenda.hora_desde or ''),
        medico=medico,
        especialidad=especialidad,
        indicaciones=consulta.indicaciones or '—',
    )


def _consulta_qs_base():
    agenda_futura = Agenda.objects.filter(
        is_deleted=False,
        paciente=OuterRef('agenda__paciente'),
        fecha=OuterRef('proxima_cita'),
    ).exclude(estado=Agenda.Estado.CANCELADO)

    return (
        Consulta.objects
        .filter(is_deleted=False, proxima_cita__isnull=False)
        .select_related(
            'agenda__paciente__persona',
            'agenda__horario_prestador__persona_rrhh__persona',
        )
        .prefetch_related(
            'agenda__horario_prestador__persona_rrhh__especialidades',
            Prefetch(
                'notificaciones',
                queryset=Notificacion.objects.filter(
                    is_deleted=False
                ).order_by('-fecha_creacion'),
                to_attr='notificaciones_prefetch',
            ),
        )
        .annotate(tiene_agenda=Exists(agenda_futura))
        .order_by('proxima_cita')
    )


def _serializar_consulta(c):
    hoy           = date.today()
    dias_restantes = (c.proxima_cita - hoy).days

    if dias_restantes < 0:
        urgencia = 'vencida'
    elif dias_restantes <= 7:
        urgencia = 'urgente'
    else:
        urgencia = 'normal'

    paciente = c.agenda.paciente
    persona  = paciente.persona if paciente else None
    rrhh     = c.agenda.horario_prestador.persona_rrhh
    esp_list = list(rrhh.especialidades.values_list('descripcion', flat=True)[:1]) if rrhh else []

    ultima = getattr(c, 'notificaciones_prefetch', [])
    ultima_notif = None
    if ultima:
        n = ultima[0]
        ultima_notif = {
            'id':            n.id,
            'tipo':          n.tipo,
            'tipo_display':  n.get_tipo_display(),
            'canal':         n.canal,
            'estado':        n.estado,
            'fecha_creacion': n.fecha_creacion.isoformat(),
        }

    return {
        'consulta_id':    c.id,
        'paciente': {
            'id':       paciente.id if paciente else None,
            'nombre':   persona.razon_social if persona else '—',
            'telefono': persona.telefono if persona else None,
            'email':    persona.correo_electronico if persona else None,
        },
        'proxima_cita':    str(c.proxima_cita),
        'dias_restantes':  dias_restantes,
        'urgencia':        urgencia,
        'medico_sugerido': {
            'id':          rrhh.id if rrhh else None,
            'nombre':      rrhh.persona.razon_social if rrhh else '—',
            'especialidad': esp_list[0] if esp_list else '—',
        },
        'diagnostico':         c.diagnostico,
        'indicaciones':        c.indicaciones,
        'estado':              'agendado' if c.tiene_agenda else 'pendiente',
        'ultima_notificacion': ultima_notif,
    }


class RecordatorioViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'], url_path='proximas-citas')
    def proximas_citas(self, request):
        params   = request.query_params
        periodo  = params.get('periodo', '')
        dias     = int(params.get('dias', 30))
        medico   = params.get('medico', '')
        estado_f = params.get('estado', '')

        hoy = date.today()
        qs  = _consulta_qs_base()

        if periodo == 'vencidas':
            qs = qs.filter(proxima_cita__lt=hoy)
        elif periodo == 'todos':
            pass
        else:
            qs = qs.filter(
                proxima_cita__gte=hoy,
                proxima_cita__lte=hoy + timedelta(days=dias),
            )

        if medico:
            qs = qs.filter(agenda__horario_prestador__persona_rrhh_id=medico)

        if estado_f == 'agendado':
            qs = qs.filter(tiene_agenda=True)
        elif estado_f == 'pendiente':
            qs = qs.filter(tiene_agenda=False)

        data = [_serializar_consulta(c) for c in qs]
        return Response(data)

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        hoy         = date.today()
        proximos_7  = hoy + timedelta(days=7)
        proximos_30 = hoy + timedelta(days=30)

        agenda_futura = Agenda.objects.filter(
            is_deleted=False,
            paciente=OuterRef('agenda__paciente'),
            fecha=OuterRef('proxima_cita'),
        ).exclude(estado=Agenda.Estado.CANCELADO)

        base = (
            Consulta.objects
            .filter(is_deleted=False, proxima_cita__isnull=False)
            .annotate(tiene_agenda=Exists(agenda_futura))
        )

        return Response({
            'vencidas':       base.filter(proxima_cita__lt=hoy).count(),
            'proximos_7_dias':  base.filter(proxima_cita__gte=hoy, proxima_cita__lte=proximos_7).count(),
            'proximos_30_dias': base.filter(proxima_cita__gte=hoy, proxima_cita__lte=proximos_30).count(),
            'agendadas':      base.filter(tiene_agenda=True).count(),
        })

    @action(detail=False, methods=['post'], url_path='notificar')
    def notificar(self, request):
        consulta_id          = request.data.get('consulta_id')
        tipo                 = request.data.get('tipo')
        canal                = request.data.get('canal', 'manual')
        mensaje_personalizado = request.data.get('mensaje_personalizado', '').strip()

        if not consulta_id or not tipo:
            raise ValidationError({'error': 'consulta_id y tipo son requeridos.'})

        try:
            consulta = (
                Consulta.objects
                .select_related(
                    'agenda__paciente__persona',
                    'agenda__horario_prestador__persona_rrhh__persona',
                )
                .prefetch_related('agenda__horario_prestador__persona_rrhh__especialidades')
                .get(id=consulta_id, is_deleted=False)
            )
        except Consulta.DoesNotExist:
            return Response({'error': 'Consulta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        paciente = consulta.agenda.paciente
        persona  = paciente.persona if paciente else None

        if canal == 'email':
            destinatario = (persona.correo_electronico or '') if persona else ''
        else:
            destinatario = (persona.telefono or '') if persona else ''

        mensaje = mensaje_personalizado or _build_mensaje(tipo, consulta)

        notif = Notificacion.objects.create(
            paciente=paciente,
            consulta=consulta,
            tipo=tipo,
            canal=canal,
            estado=Notificacion.Estado.PENDIENTE,
            mensaje=mensaje,
            destinatario=destinatario,
            id_usu_creator=request.user,
        )

        if canal == Notificacion.Canal.EMAIL:
            from .services import enviar_notificacion
            enviar_notificacion(notif.id)
            notif.refresh_from_db()

        return Response({
            'ok':     True,
            'id':     notif.id,
            'estado': notif.estado,
        })


class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class   = NotificacionListSerializer
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['fecha_creacion']
    ordering           = ['-fecha_creacion']

    def get_queryset(self):
        qs       = Notificacion.objects.filter(is_deleted=False)
        paciente = self.request.query_params.get('paciente')
        consulta = self.request.query_params.get('consulta')
        if paciente:
            qs = qs.filter(paciente_id=paciente)
        if consulta:
            qs = qs.filter(consulta_id=consulta)
        return qs

    @action(detail=False, methods=['get', 'patch'], url_path='configuracion',
            permission_classes=[IsAuthenticated, IsAdminRole])
    def configuracion(self, request):
        conf = ConfiguracionNotificacion.get_solo()
        if request.method == 'PATCH':
            serializer = ConfiguracionNotificacionSerializer(conf, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(ConfiguracionNotificacionSerializer(conf).data)

    @action(detail=False, methods=['post'], url_path='probar-conexion',
            permission_classes=[IsAuthenticated, IsAdminRole])
    def probar_conexion(self, request):
        from .services import probar_conexion
        ok, mensaje = probar_conexion()
        return Response({'ok': ok, 'mensaje': mensaje},
                        status=status.HTTP_200_OK if ok else status.HTTP_503_SERVICE_UNAVAILABLE)

    @action(detail=True, methods=['post'], url_path='reenviar',
            permission_classes=[IsAuthenticated, IsAdminOrRecepcionista])
    def reenviar(self, request, pk=None):
        notif = self.get_object()
        if notif.canal != Notificacion.Canal.EMAIL:
            raise ValidationError({'error': 'Solo se pueden reenviar notificaciones por email.'})
        from .services import enviar_notificacion
        notif.estado = Notificacion.Estado.PENDIENTE
        notif.save(update_fields=['estado'])
        enviar_notificacion(notif.id)
        notif.refresh_from_db()
        return Response(NotificacionListSerializer(notif).data)


class PlantillaViewSet(viewsets.ModelViewSet):
    filter_backends = [filters.OrderingFilter]
    ordering        = ['tipo']

    def get_queryset(self):
        return PlantillaNotificacion.objects.filter(is_deleted=False)

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return PlantillaNotificacionListSerializer
        return PlantillaNotificacionSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        from django.utils import timezone
        instance.is_deleted        = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=['post'], url_path='subir-imagen',
            permission_classes=[IsAuthenticated, IsAdminRole])
    def subir_imagen(self, request):
        import os
        from datetime import datetime
        from django.conf import settings

        archivo = request.FILES.get('file')
        if not archivo:
            return Response({'error': 'No se envió ningún archivo.'}, status=status.HTTP_400_BAD_REQUEST)
        if not archivo.content_type.startswith('image/'):
            return Response({'error': 'Solo se permiten imágenes.'}, status=status.HTTP_400_BAD_REQUEST)

        nombre_seguro = re.sub(r'[^\w.\-]', '_', archivo.name)
        nombre        = f"{datetime.now().strftime('%Y%m%d%H%M%S')}_{nombre_seguro}"
        rel           = f'plantillas/imagenes/{nombre}'
        ruta          = os.path.join(settings.MEDIA_ROOT, rel)
        os.makedirs(os.path.dirname(ruta), exist_ok=True)

        with open(ruta, 'wb+') as dest:
            for chunk in archivo.chunks():
                dest.write(chunk)

        return Response({'url': f"{settings.MEDIA_URL}{rel}"})
