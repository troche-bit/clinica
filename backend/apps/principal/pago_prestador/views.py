from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.forma_pago.models import FormaPago
from apps.principal.caja_banco.models import CuentaMcb, MovimientoCajaBanco
from apps.principal.agenda.models import Agenda
from apps.principal.persona_rrhh.models import PersonaRRHH

from .models import PagoPrestador, PagoPrestadorDetCobranza
from .serializers import (
    PagoPrestadorListSerializer,
    PagoPrestadorDetalleSerializer,
    PagoPrestadorCreateSerializer,
)


class PagoPrestadorViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['persona_rrhh__persona__razon_social', 'persona_rrhh__persona__nro_documento']
    ordering_fields    = ['fecha_pago', 'monto_total', 'fecha_creacion']
    ordering           = ['-fecha_pago', '-fecha_creacion']

    def get_queryset(self):
        qs = PagoPrestador.objects.filter(is_deleted=False).select_related(
            'persona_rrhh__persona'
        )
        if rrhh_id := self.request.query_params.get('persona_rrhh'):
            qs = qs.filter(persona_rrhh_id=rrhh_id)
        if estado := self.request.query_params.get('estado'):
            qs = qs.filter(estado=estado)
        if desde := self.request.query_params.get('fecha_desde'):
            qs = qs.filter(fecha_pago__gte=desde)
        if hasta := self.request.query_params.get('fecha_hasta'):
            qs = qs.filter(fecha_pago__lte=hasta)
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return PagoPrestadorCreateSerializer
        if self.action == 'retrieve':
            return PagoPrestadorDetalleSerializer
        return PagoPrestadorListSerializer

    # ── Creación en transacción atómica ──────────────────────────────────────

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = PagoPrestadorCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            medico = PersonaRRHH.objects.get(pk=data['persona_rrhh_id'], is_deleted=False)
        except PersonaRRHH.DoesNotExist:
            raise ValidationError({'persona_rrhh_id': 'Prestador no encontrado.'})

        monto_hora  = Decimal(str(data['monto_hora']))
        total_hora  = sum(Decimal(str(b['horas'])) for b in data['bloques'])
        monto_total = (total_hora * monto_hora).quantize(Decimal('0.01'))

        total_pagado = sum(Decimal(str(v['monto'])) for v in data['valores_pagados'])

        if total_pagado >= monto_total:
            estado = 'pagado'
            saldo  = Decimal('0')
        elif total_pagado > Decimal('0'):
            estado = 'parcial'
            saldo  = monto_total - total_pagado
        else:
            estado = 'pendiente'
            saldo  = monto_total

        pago = PagoPrestador.objects.create(
            persona_rrhh   = medico,
            fecha_pago     = data['fecha_pago'],
            monto_hora     = monto_hora,
            total_hora     = total_hora,
            monto_total    = monto_total,
            saldo          = saldo,
            estado         = estado,
            id_usu_creator = request.user,
        )

        # Marcar turnos de Agenda como pagados
        for bloque in data['bloques']:
            Agenda.objects.filter(
                id__in=bloque['agenda_ids'],
                is_deleted=False,
            ).update(
                pagado_prestador    = True,
                pago_prestador      = pago,
                id_usu_modificator  = request.user,
            )

        # Guardar detalles de cobranza y movimientos de caja
        for val in data['valores_pagados']:
            try:
                fp  = FormaPago.objects.get(pk=val['forma_pago_id'])
                cta = CuentaMcb.objects.get(pk=val['cta_id'], is_deleted=False)
            except (FormaPago.DoesNotExist, CuentaMcb.DoesNotExist) as e:
                raise ValidationError({'valores_pagados': str(e)})

            det = PagoPrestadorDetCobranza.objects.create(
                pago_prestador = pago,
                forma_pago     = fp,
                cta            = cta,
                monto          = val['monto'],
                voucher        = val.get('voucher', ''),
                id_usu_creator = request.user,
            )

            MovimientoCajaBanco.objects.create(
                cta            = cta,
                fecha          = data['fecha_pago'],
                voucher        = val.get('voucher', '') or None,
                monto_ingreso  = val['monto'],
                monto_egreso   = Decimal('0'),
                vuelto         = Decimal('0'),
                ppdc_id        = det.id,
                id_usu_creator = request.user,
            )

        out = PagoPrestadorDetalleSerializer(pago)
        return Response(out.data, status=201)

    # ── Borrado lógico ────────────────────────────────────────────────────────

    def perform_destroy(self, instance):
        det_ids = list(instance.detalle_cobranza.filter(is_deleted=False).values_list('id', flat=True))
        if MovimientoCajaBanco.objects.filter(ppdc_id__in=det_ids, is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: tiene movimientos de caja vinculados.')

        now = timezone.now()
        # Desmarcar turnos de Agenda
        Agenda.objects.filter(pago_prestador=instance, is_deleted=False).update(
            pagado_prestador   = False,
            pago_prestador     = None,
            id_usu_modificator = self.request.user,
        )
        instance.detalle_cobranza.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=self.request.user,
        )
        instance.is_deleted         = True
        instance.fecha_eliminacion  = now
        instance.id_usu_modificator = self.request.user
        instance.save()

    # ── Endpoints personalizados ──────────────────────────────────────────────

    @action(detail=False, methods=['get'], url_path='siguiente-numero')
    def siguiente_numero(self, request):
        max_id = PagoPrestador.objects.filter(is_deleted=False).aggregate(
            max_id=Max('id')
        )['max_id']
        return Response({'siguiente': (max_id or 0) + 1})

    @action(detail=False, methods=['get'], url_path='bloques-pendientes')
    def bloques_pendientes(self, request):
        rrhh_id    = request.query_params.get('persona_rrhh')
        fecha_hasta = request.query_params.get('fecha_hasta')

        if not rrhh_id:
            return Response({'error': 'Se requiere persona_rrhh.'}, status=400)

        filtros = {
            'horario_prestador__persona_rrhh_id': rrhh_id,
            'pagado_prestador': False,
            'is_deleted': False,
        }
        if fecha_hasta:
            filtros['fecha__lte'] = fecha_hasta

        turnos = (
            Agenda.objects
            .filter(**filtros)
            .select_related('horario_prestador__persona_rrhh')
            .prefetch_related('horario_prestador__especialidades')
            .order_by('fecha', 'horario_prestador_id')
        )

        # Agrupar por (horario_prestador_id, fecha)
        bloques = {}
        for t in turnos:
            hp = t.horario_prestador
            key = (hp.id, str(t.fecha))
            if key not in bloques:
                hora_desde = hp.hora_desde
                hora_hasta = hp.hora_hasta
                segundos   = (
                    hora_hasta.hour * 3600 + hora_hasta.minute * 60 + hora_hasta.second
                ) - (
                    hora_desde.hour * 3600 + hora_desde.minute * 60 + hora_desde.second
                )
                horas = round(max(segundos, 0) / 3600, 2)
                especialidades = ', '.join(
                    e.descripcion for e in hp.especialidades.filter(is_deleted=False)
                )
                bloques[key] = {
                    'horario_prestador_id': hp.id,
                    'fecha':       str(t.fecha),
                    'hora_desde':  str(hora_desde)[:5],
                    'hora_hasta':  str(hora_hasta)[:5],
                    'horas':       horas,
                    'especialidad': especialidades,
                    'agenda_ids':  [],
                }
            bloques[key]['agenda_ids'].append(t.id)

        return Response(list(bloques.values()))
