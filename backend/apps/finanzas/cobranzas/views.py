from decimal import Decimal
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from apps.administracion.persona.models import Persona
from apps.forma_pago.models import FormaPago
from apps.finanzas.caja_banco.models import CuentaMcb, MovimientoCajaBanco
from apps.finanzas.estadocuenta.models import CtaCobrar

from .models import Cobranza, CobranzaDet, ValorRecibidoCob
from .serializers import (
    CobranzaListSerializer,
    CobranzaDetalleSerializer,
    CobranzaCreateSerializer,
)


def _siguiente_comprobante_nro():
    max_nro = Cobranza.objects.filter(is_deleted=False).aggregate(
        max_nro=Max('comprobante_nro')
    )['max_nro']
    return (max_nro or 0) + 1


class CobranzaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ['persona__razon_social', 'persona__nro_documento']
    ordering_fields = ['fecha', 'monto', 'fecha_creacion']
    ordering        = ['-fecha', '-fecha_creacion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'siguiente_numero', 'cuotas_pendientes'):
            return [IsAuthenticated()]
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_queryset(self):
        qs = Cobranza.objects.filter(is_deleted=False).select_related('persona')

        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)

        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return CobranzaCreateSerializer
        if self.action == 'retrieve':
            return CobranzaDetalleSerializer
        return CobranzaListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = CobranzaCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            persona = Persona.objects.get(pk=data['persona'], is_deleted=False)
        except Persona.DoesNotExist:
            raise ValidationError({'persona': 'Persona no encontrada.'})

        comprobante_nro = _siguiente_comprobante_nro()

        cuotas_data = []
        monto_total = Decimal('0')
        for det in data['detalle']:
            try:
                cta = CtaCobrar.objects.select_for_update().get(pk=det['cta_cobrar_id'], is_deleted=False)
            except CtaCobrar.DoesNotExist:
                raise ValidationError({'detalle': f"Cuota ID {det['cta_cobrar_id']} no encontrada."})

            if det['monto_pagado'] <= Decimal('0'):
                raise ValidationError({'detalle': f'El monto a pagar de la cuota {cta.id} debe ser mayor a 0.'})

            if det['monto_pagado'] > cta.saldo:
                raise ValidationError({
                    'detalle': f"El monto a pagar ({det['monto_pagado']}) supera el saldo disponible ({cta.saldo}) de la cuota {cta.id}."
                })

            cuotas_data.append({'cta': cta, 'det': det})
            monto_total += Decimal(str(det['monto_pagado']))

        total_recibido = sum(Decimal(str(v['monto'])) for v in data['valores_recibidos'])
        vuelto         = max(Decimal('0'), total_recibido - monto_total)

        cab = Cobranza.objects.create(
            fecha           = data['fecha'],
            persona         = persona,
            comprobante_nro = comprobante_nro,
            monto           = monto_total,
            vuelto          = vuelto,
            id_usu_creator  = request.user,
        )

        for item in cuotas_data:
            cta            = item['cta']
            det            = item['det']
            saldo_anterior = cta.saldo

            CobranzaDet.objects.create(
                cobranza        = cab,
                cta_cobrar      = cta,
                monto_total     = saldo_anterior,
                monto_pagado    = det['monto_pagado'],
                nro_comprobante = det.get('nro_comprobante', ''),
                id_usu_creator  = request.user,
            )

            nuevo_saldo = saldo_anterior - Decimal(str(det['monto_pagado']))
            cta.saldo   = nuevo_saldo
            if nuevo_saldo <= Decimal('0'):
                cta.estado = 'pagado'
            cta.id_usu_modificator = request.user
            cta.save()

        for val in data['valores_recibidos']:
            try:
                fp  = FormaPago.objects.get(pk=val['forma_pago_id'])
                cta = CuentaMcb.objects.get(pk=val['cta_id'], is_deleted=False)
            except (FormaPago.DoesNotExist, CuentaMcb.DoesNotExist) as e:
                raise ValidationError({'valores_recibidos': str(e)})

            vrc = ValorRecibidoCob.objects.create(
                cobranza        = cab,
                forma_pago      = fp,
                cta             = cta,
                monto           = val['monto'],
                voucher         = val.get('voucher', ''),
                nro_comprobante = val.get('nro_comprobante', ''),
                id_usu_creator  = request.user,
            )

            MovimientoCajaBanco.objects.create(
                cta            = cta,
                fecha          = data['fecha'],
                voucher        = val.get('voucher', '') or None,
                monto_ingreso  = val['monto'],
                monto_egreso   = Decimal('0'),
                vuelto         = Decimal('0'),
                vrc_id         = vrc.id,
                id_usu_creator = request.user,
            )

        return Response(CobranzaDetalleSerializer(cab).data, status=201)

    def perform_destroy(self, instance):
        now     = timezone.now()
        hoy     = timezone.localtime(now).date()
        vrc_ids = list(instance.valores_recibidos.filter(is_deleted=False).values_list('id', flat=True))

        for det in instance.detalle.filter(is_deleted=False).select_related('cta_cobrar'):
            cta        = det.cta_cobrar
            cta.saldo += det.monto_pagado
            cta.estado = 'vencido' if cta.fecha_vencimiento < hoy else 'pendiente'
            cta.id_usu_modificator = self.request.user
            cta.save()

        MovimientoCajaBanco.objects.filter(vrc_id__in=vrc_ids, is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=self.request.user
        )
        instance.valores_recibidos.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=self.request.user
        )
        instance.detalle.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=self.request.user
        )
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='siguiente-numero')
    def siguiente_numero(self, request):
        return Response({'siguiente': _siguiente_comprobante_nro()})

    @action(detail=False, methods=['get'], url_path='cuotas-pendientes')
    def cuotas_pendientes(self, request):
        persona_id = request.query_params.get('persona')
        if not persona_id:
            return Response({'error': 'Se requiere el parámetro persona.'}, status=400)

        cuotas = CtaCobrar.objects.filter(
            is_deleted=False,
            saldo__gt=0,
            vfc__persona_id=persona_id,
            vfc__is_deleted=False,
        ).select_related('vfc', 'vfc__timbrado').order_by('fecha_vencimiento', 'id')

        resultado = []
        for c in cuotas:
            vfc   = c.vfc
            estab = vfc.establecimiento if vfc.establecimiento else str(vfc.timbrado.punto_sucursal).zfill(3)
            expd  = vfc.expedicion if vfc.expedicion else str(vfc.timbrado.punto_expedicion).zfill(3)
            resultado.append({
                'id':                c.id,
                'nro_cuota':         c.nro_cuota,
                'cant_cuota':        c.cant_cuota,
                'monto_cuota':       str(c.monto_cuota),
                'saldo':             str(c.saldo),
                'fecha_vencimiento': str(c.fecha_vencimiento),
                'estado':            c.estado,
                'factura_nro':       f'{estab}-{expd}-{str(vfc.nro_comprobante).zfill(7)}',
                'factura_fecha':     str(vfc.fecha),
                'factura_id':        vfc.id,
            })

        return Response(resultado)
