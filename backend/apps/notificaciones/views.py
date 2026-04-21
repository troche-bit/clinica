from datetime import date, timedelta

from django.db.models import Exists, OuterRef, Prefetch
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from apps.principal.consultas.models import Consulta
from apps.principal.agenda.models import Agenda
from .models import Notificacion
from .serializers import NotificacionListSerializer


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
    """Construye el mensaje a partir de la plantilla y datos de la consulta."""
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
    """QuerySet base de consultas con próxima cita activa."""
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
    """Convierte una Consulta en el dict de respuesta del módulo recordatorios."""
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
    """Endpoints de lectura y operaciones del módulo de recordatorios."""
    permission_classes = [IsAuthenticated]

    # ── GET /api/recordatorios/proximas-citas/ ───────────────────────────────
    @action(detail=False, methods=['get'], url_path='proximas-citas')
    def proximas_citas(self, request):
        params   = request.query_params
        periodo  = params.get('periodo', '')       # vencidas | todos
        dias     = int(params.get('dias', 30))
        medico   = params.get('medico', '')
        estado_f = params.get('estado', '')        # pendiente | agendado

        hoy = date.today()
        qs  = _consulta_qs_base()

        # Filtro temporal
        if periodo == 'vencidas':
            qs = qs.filter(proxima_cita__lt=hoy)
        elif periodo == 'todos':
            pass
        else:
            qs = qs.filter(
                proxima_cita__gte=hoy,
                proxima_cita__lte=hoy + timedelta(days=dias),
            )

        # Filtro médico
        if medico:
            qs = qs.filter(agenda__horario_prestador__persona_rrhh_id=medico)

        # Filtro estado (agendado / pendiente)
        if estado_f == 'agendado':
            qs = qs.filter(tiene_agenda=True)
        elif estado_f == 'pendiente':
            qs = qs.filter(tiene_agenda=False)

        data = [_serializar_consulta(c) for c in qs]
        return Response(data)

    # ── GET /api/recordatorios/stats/ ────────────────────────────────────────
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

    # ── POST /api/recordatorios/notificar/ ───────────────────────────────────
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

        # Destinatario según canal
        if canal == 'email':
            destinatario = (persona.correo_electronico or '') if persona else ''
        else:
            destinatario = (persona.telefono or '') if persona else ''

        # Mensaje: usar personalizado o construir desde plantilla
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

        # TODO: Agregar lógica de envío real aquí (django-anymail / Twilio)
        # El frontend no cambia — solo agregar el envío antes del return.

        return Response({
            'ok':     True,
            'id':     notif.id,
            'mensaje': 'Notificación registrada. Envío por configurar.',
        })


class NotificacionViewSet(viewsets.ReadOnlyModelViewSet):
    """Historial de notificaciones enviadas (solo lectura)."""
    permission_classes = [IsAuthenticated]
    serializer_class   = NotificacionListSerializer
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['fecha_creacion']
    ordering           = ['-fecha_creacion']

    def get_queryset(self):
        qs        = Notificacion.objects.filter(is_deleted=False)
        paciente  = self.request.query_params.get('paciente')
        consulta  = self.request.query_params.get('consulta')
        if paciente:
            qs = qs.filter(paciente_id=paciente)
        if consulta:
            qs = qs.filter(consulta_id=consulta)
        return qs
