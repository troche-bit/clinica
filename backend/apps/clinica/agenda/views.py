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
            'asignar', 'cambiar_estado', 'reagendar', 'dashboard_agenda',
            'reporte_agenda', 'dashboard_prestadores', 'dashboard_ocupacion',
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
            'consultas',
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

        try:
            from apps.mantenimiento.notificaciones.models import Notificacion
            from apps.mantenimiento.notificaciones.services import enviar_notificacion
            persona = paciente.persona if paciente else None
            email   = persona.correo_electronico if persona else None
            if email:
                notif = Notificacion.objects.create(
                    paciente=paciente,
                    agenda=turno,
                    tipo=Notificacion.Tipo.CONFIRMACION_RESERVA,
                    canal=Notificacion.Canal.EMAIL,
                    estado=Notificacion.Estado.PENDIENTE,
                    mensaje='',
                    destinatario=email,
                    id_usu_creator=request.user,
                )
                enviar_notificacion(notif.id)
        except Exception:
            pass

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

        from apps.clinica.consultas.models import Consulta
        consulta_activa = Consulta.objects.filter(agenda=turno, is_deleted=False).first()
        if consulta_activa:
            estado_consulta = consulta_activa.estado
            MENSAJES = {
                Consulta.Estado.EN_CONSULTA: 'Este turno tiene una consulta en curso — finalizá o anulá la consulta antes de modificar el turno.',
                Consulta.Estado.FINALIZADA:  'Este turno ya fue completado. La consulta está finalizada y no puede modificarse desde la agenda.',
                Consulta.Estado.ANULADA:     'Este turno tiene una consulta anulada. No se puede modificar el estado desde la agenda.',
            }
            if estado_consulta in MENSAJES:
                raise ValidationError({'estado': MENSAJES[estado_consulta]})

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

        paciente_cancelado = turno.paciente if nuevo == Agenda.Estado.CANCELADO else None

        if nuevo in [Agenda.Estado.CANCELADO, Agenda.Estado.DISPONIBLE] and turno.paciente:
            turno.paciente = None

        turno.estado             = nuevo
        turno.id_usu_modificator = request.user
        turno.save()

        if paciente_cancelado:
            try:
                from apps.mantenimiento.notificaciones.models import Notificacion
                from apps.mantenimiento.notificaciones.services import enviar_notificacion
                persona = paciente_cancelado.persona if paciente_cancelado else None
                email   = persona.correo_electronico if persona else None
                if email:
                    notif = Notificacion.objects.create(
                        paciente=paciente_cancelado,
                        agenda=turno,
                        tipo=Notificacion.Tipo.CANCELACION,
                        canal=Notificacion.Canal.EMAIL,
                        estado=Notificacion.Estado.PENDIENTE,
                        mensaje='',
                        destinatario=email,
                        id_usu_creator=request.user,
                    )
                    enviar_notificacion(notif.id)
            except Exception:
                pass

        return Response(AgendaListSerializer(turno).data)

    @action(detail=True, methods=['patch'], url_path='reagendar')
    def reagendar(self, request, pk=None):
        turno_actual = self.get_object()

        if turno_actual.estado != Agenda.Estado.OCUPADO:
            raise ValidationError({'estado': 'Solo se puede reagendar un turno ocupado.'})

        from apps.clinica.consultas.models import Consulta
        consulta_activa = Consulta.objects.filter(agenda=turno_actual, is_deleted=False).first()
        if consulta_activa and consulta_activa.estado in (
            Consulta.Estado.EN_CONSULTA, Consulta.Estado.FINALIZADA, Consulta.Estado.ANULADA
        ):
            raise ValidationError(
                {'estado': 'No se puede reagendar: el turno tiene una consulta asociada. Finalizá o anulá la consulta antes de reagendar.'}
            )

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
        hora_desde_s    = request.data.get('hora_desde') or None
        hora_hasta_s    = request.data.get('hora_hasta') or None

        if not all([persona_rrhh_id, fecha_desde_s, fecha_hasta_s]):
            return Response(
                {'error': 'persona_rrhh, fecha_desde y fecha_hasta son requeridos.'},
                status=400,
            )

        base_qs = self.get_queryset().filter(
            horario_prestador__persona_rrhh_id=persona_rrhh_id,
            fecha__gte=fecha_desde_s,
            fecha__lte=fecha_hasta_s,
        )
        if hora_desde_s:
            base_qs = base_qs.filter(hora_desde__gte=hora_desde_s)
        if hora_hasta_s:
            base_qs = base_qs.filter(hora_hasta__lte=hora_hasta_s)

        no_cancelados = []
        for t in base_qs.filter(
            estado__in=[Agenda.Estado.OCUPADO, Agenda.Estado.REALIZADO]
        ).select_related('paciente__persona'):
            paciente_nombre = None
            if t.paciente_id:
                paciente_nombre = t.paciente.persona.razon_social
            no_cancelados.append({
                'fecha':      str(t.fecha),
                'hora_desde': str(t.hora_desde)[:5],
                'estado':     t.estado,
                'paciente':   paciente_nombre,
            })

        disp_qs = base_qs.filter(estado=Agenda.Estado.DISPONIBLE)
        count = disp_qs.count()
        disp_qs.update(
            estado=Agenda.Estado.CANCELADO,
            id_usu_modificator_id=request.user.pk,
        )

        return Response({'cancelados': count, 'no_cancelados': no_cancelados})

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

    @action(detail=False, methods=['get'], url_path='dashboard-agenda')
    def dashboard_agenda(self, request):
        import calendar
        from datetime import date
        from django.db.models import F

        hoy        = timezone.localtime().date()
        inicio_mes = hoy.replace(day=1)

        qs_base = Agenda.objects.filter(is_deleted=False)
        qs_mes  = qs_base.filter(fecha__gte=inicio_mes, fecha__lte=hoy)

        por_estado = {
            'disponible': qs_mes.filter(estado='disponible').count(),
            'ocupado':    qs_mes.filter(estado='ocupado').count(),
            'realizado':  qs_mes.filter(estado='realizado').count(),
            'cancelado':  qs_mes.filter(estado='cancelado').count(),
            'inactivo':   qs_mes.filter(estado='inactivo').count(),
        }
        total_mes = sum(por_estado.values())

        top_prestadores = list(
            qs_mes
            .filter(estado__in=['ocupado', 'realizado'])
            .values(nombre=F('horario_prestador__persona_rrhh__persona__razon_social'))
            .annotate(total=Count('id'))
            .order_by('-total')[:5]
        )

        MESES_ES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        comparativa = []
        for i in range(5, -1, -1):
            mes_ref  = hoy.month - i
            anio_ref = hoy.year
            while mes_ref <= 0:
                mes_ref  += 12
                anio_ref -= 1
            inicio = date(anio_ref, mes_ref, 1)
            fin    = date(anio_ref, mes_ref, calendar.monthrange(anio_ref, mes_ref)[1])
            if fin > hoy:
                fin = hoy
            qs_m = qs_base.filter(fecha__gte=inicio, fecha__lte=fin)
            comparativa.append({
                'mes':        mes_ref,
                'anio':       anio_ref,
                'label':      f"{MESES_ES[mes_ref]} {str(anio_ref)[2:]}",
                'realizados': qs_m.filter(estado='realizado').count(),
                'cancelados': qs_m.filter(estado='cancelado').count(),
                'total':      qs_m.count(),
            })

        return Response({
            'total_mes':           total_mes,
            'por_estado':          por_estado,
            'top_prestadores':     top_prestadores,
            'comparativa_6_meses': comparativa,
        })

    @action(detail=False, methods=['get'], url_path='reporte-agenda')
    def reporte_agenda(self, request):
        from django.template.loader import render_to_string
        from django.http import HttpResponse
        from collections import defaultdict
        import weasyprint

        hoy          = timezone.localdate()
        fecha_desde  = request.query_params.get('fecha_desde', str(hoy))
        fecha_hasta  = request.query_params.get('fecha_hasta', str(hoy))
        persona_rrhh = request.query_params.get('persona_rrhh', '')
        especialidad = request.query_params.get('especialidad', '')
        estado       = request.query_params.get('estado', '')

        qs = (
            Agenda.objects.filter(is_deleted=False, fecha__gte=fecha_desde, fecha__lte=fecha_hasta)
            .select_related(
                'horario_prestador__persona_rrhh__persona',
                'horario_prestador__consultorio',
                'paciente__persona',
            )
            .prefetch_related('horario_prestador__especialidades')
            .order_by(
                'horario_prestador__persona_rrhh__persona__razon_social',
                'fecha', 'hora_desde',
            )
        )
        if persona_rrhh:
            qs = qs.filter(horario_prestador__persona_rrhh_id=persona_rrhh)
        if especialidad:
            qs = qs.filter(horario_prestador__especialidades__id=especialidad).distinct()
        if estado:
            qs = qs.filter(estado=estado)

        ESTADO_LABEL = {
            'disponible': 'Disponible', 'ocupado': 'Ocupado',
            'realizado': 'Realizado', 'cancelado': 'Cancelado', 'inactivo': 'Inactivo',
        }

        grupos_dict = defaultdict(list)
        for t in qs:
            hp   = t.horario_prestador
            esps = hp.especialidades.all() if hp else []
            nombre_medico = (
                hp.persona_rrhh.persona.razon_social
                if hp and hp.persona_rrhh and hp.persona_rrhh.persona
                else 'Sin médico'
            )
            grupos_dict[nombre_medico].append({
                'fecha':       t.fecha.strftime('%d/%m/%Y'),
                'hora':        t.hora_desde.strftime('%H:%M') if t.hora_desde else '—',
                'paciente':    t.paciente.persona.razon_social if t.paciente and t.paciente.persona else '—',
                'especialidad': ', '.join(e.descripcion for e in esps) or '—',
                'estado':      ESTADO_LABEL.get(t.estado, t.estado.title()),
                'estado_raw':  t.estado,
            })

        grupos_medico = [
            {'medico': nombre, 'turnos': lista, 'total': len(lista)}
            for nombre, lista in sorted(grupos_dict.items())
        ]
        total_global = sum(g['total'] for g in grupos_medico)

        html = render_to_string('informes/agenda_lista.html', {
            'grupos_medico': grupos_medico,
            'fecha_desde':   fecha_desde,
            'fecha_hasta':   fecha_hasta,
            'total':         total_global,
            'filtros': {
                'estado': ESTADO_LABEL.get(estado, '') if estado else 'Todos',
            },
        })
        pdf = weasyprint.HTML(string=html).write_pdf()
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="agenda_{hoy.strftime("%Y%m%d")}.pdf"'
        return response

    @action(detail=False, methods=['get'], url_path='dashboard-prestadores')
    def dashboard_prestadores(self, request):
        from django.db.models import F
        from django.db.models.functions import ExtractWeekDay

        hoy        = timezone.localdate()
        inicio_mes = hoy.replace(day=1)
        qs_mes     = Agenda.objects.filter(is_deleted=False, fecha__gte=inicio_mes, fecha__lte=hoy)

        # Turnos por médico con porcentaje de ocupación
        por_medico_raw = (
            qs_mes
            .values(nombre=F('horario_prestador__persona_rrhh__persona__razon_social'))
            .annotate(
                realizados=Count('id', filter=Q(estado='realizado')),
                ocupados=Count('id', filter=Q(estado='ocupado')),
                cancelados=Count('id', filter=Q(estado='cancelado')),
                total=Count('id'),
            )
            .exclude(nombre=None)
            .order_by('-realizados')[:10]
        )
        turnos_por_medico = []
        for r in por_medico_raw:
            total      = r['total'] or 0
            realizados = r['realizados'] or 0
            turnos_por_medico.append({
                'nombre':        r['nombre'] or '—',
                'realizados':    realizados,
                'ocupados':      r['ocupados'] or 0,
                'cancelados':    r['cancelados'] or 0,
                'total':         total,
                'pct_ocupacion': round(realizados / total * 100) if total > 0 else 0,
            })

        # Comparativa por especialidad via M2M
        from apps.clinica.configuracion.especialidad.models import Especialidad
        comparativa_esp = []
        for esp in Especialidad.objects.filter(is_deleted=False):
            qs_esp = qs_mes.filter(horario_prestador__especialidades=esp)
            realizados = qs_esp.filter(estado='realizado').count()
            total      = qs_esp.count()
            if total > 0:
                comparativa_esp.append({'especialidad': esp.descripcion, 'realizados': realizados, 'total': total})
        comparativa_esp = sorted(comparativa_esp, key=lambda x: -x['total'])[:8]

        # Días más demandados — ExtractWeekDay: 1=Dom...7=Sáb → convertir a 1=Lun...7=Dom
        DIAS = {1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom'}
        dias_raw = (
            qs_mes
            .filter(estado__in=['realizado', 'ocupado'])
            .annotate(dia_dj=ExtractWeekDay('fecha'))
            .values('dia_dj')
            .annotate(total=Count('id'))
            .order_by('dia_dj')
        )
        dias_dict = {}
        for r in dias_raw:
            iso = (r['dia_dj'] - 2) % 7 + 1  # convertir a ISO 1=Lun
            dias_dict[iso] = dias_dict.get(iso, 0) + r['total']
        dias = [{'dia': DIAS[i], 'total': dias_dict.get(i, 0)} for i in range(1, 8)]

        # Horarios más demandados (top 8 por hora_desde)
        horarios_raw = (
            qs_mes
            .filter(estado__in=['realizado', 'ocupado'])
            .values('hora_desde')
            .annotate(total=Count('id'))
            .order_by('-total')[:8]
        )
        horarios = sorted(
            [{'hora': r['hora_desde'].strftime('%H:%M') if r['hora_desde'] else '—', 'total': r['total']} for r in horarios_raw],
            key=lambda x: x['hora']
        )

        # Ocupación promedio global del mes
        total_global   = qs_mes.count()
        activos_global = qs_mes.filter(estado__in=['realizado', 'ocupado']).count()
        ocupacion_prom = round(activos_global / total_global * 100) if total_global > 0 else 0

        return Response({
            'turnos_por_medico':          turnos_por_medico,
            'comparativa_especialidades': comparativa_esp,
            'dias_mas_demandados':        dias,
            'horarios_mas_demandados':    horarios,
            'ocupacion_promedio':         ocupacion_prom,
            'total_mes':                  total_global,
        })

    @action(detail=False, methods=['get'], url_path='dashboard-ocupacion')
    def dashboard_ocupacion(self, request):
        import calendar
        from datetime import date
        from django.db.models import F as DjF
        from django.db.models.functions import ExtractWeekDay, ExtractHour

        hoy        = timezone.localdate()
        inicio_mes = hoy.replace(day=1)
        qs_base    = Agenda.objects.filter(is_deleted=False)
        qs_act     = qs_base.filter(fecha__gte=inicio_mes, fecha__lte=hoy, estado__in=['realizado', 'ocupado'])

        # Mapa de calor: día ISO (1=Lun) x hora
        DIAS_LABEL = {1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb', 7: 'Dom'}
        mapa_raw = (
            qs_act
            .annotate(dia_dj=ExtractWeekDay('fecha'), hora=ExtractHour('hora_desde'))
            .values('dia_dj', 'hora')
            .annotate(total=Count('id'))
            .order_by('dia_dj', 'hora')
        )
        mapa_calor = []
        for r in mapa_raw:
            iso = (r['dia_dj'] - 2) % 7 + 1
            mapa_calor.append({'dia': iso, 'dia_label': DIAS_LABEL[iso], 'hora': r['hora'], 'total': r['total']})

        # Consultorios más usados
        consultorios_raw = (
            qs_act
            .values(nombre=DjF('horario_prestador__consultorio__descripcion'))
            .annotate(total=Count('id'))
            .exclude(nombre=None)
            .order_by('-total')[:8]
        )
        consultorios = [{'consultorio': r['nombre'] or '—', 'total': r['total']} for r in consultorios_raw]

        # Picos de demanda por mes (últimos 6 meses)
        MESES_ES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        picos_por_mes = []
        for i in range(5, -1, -1):
            mes_ref  = hoy.month - i
            anio_ref = hoy.year
            while mes_ref <= 0:
                mes_ref  += 12
                anio_ref -= 1
            fin = date(anio_ref, mes_ref, calendar.monthrange(anio_ref, mes_ref)[1])
            if fin > hoy:
                fin = hoy
            inicio = date(anio_ref, mes_ref, 1)
            total = qs_base.filter(fecha__gte=inicio, fecha__lte=fin, estado__in=['realizado', 'ocupado']).count()
            picos_por_mes.append({
                'label': f"{MESES_ES[mes_ref]} {str(anio_ref)[2:]}",
                'total': total,
            })

        return Response({
            'mapa_calor':    mapa_calor,
            'consultorios':  consultorios,
            'picos_por_mes': picos_por_mes,
        })
