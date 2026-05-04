from datetime import date, timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone

from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.mantenimiento.timbrado.models import Timbrado
from apps.stock.productos.models import ProductoServicio
from apps.forma_pago.models import FormaPago
from apps.finanzas.caja_banco.models import CuentaMcb, MovimientoCajaBanco
from apps.administracion.persona.models import Persona
from apps.finanzas.estadocuenta.models import CtaCobrar

from .models import VentaFactCab, VentaFactDet, VentaFactDetCobranza
from .serializers import (
    VentaFactCabListSerializer,
    VentaFactCabDetalleSerializer,
    VentaFactCabUpdateSerializer,
    VentaFactCreateSerializer,
)
from apps.facturacion.services import calcular_item, calcular_totales


class VentaFactCabViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['persona__razon_social', 'persona__nro_documento', 'nro_comprobante']
    ordering_fields    = ['fecha', 'monto_total', 'fecha_creacion']
    ordering           = ['-fecha', '-fecha_creacion']

    def get_queryset(self):
        qs = VentaFactCab.objects.filter(is_deleted=False).select_related('persona', 'timbrado')

        condicion = self.request.query_params.get('condicion_vta')
        if condicion == 'true':
            qs = qs.filter(condicion_vta=True)
        elif condicion == 'false':
            qs = qs.filter(condicion_vta=False)

        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)

        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return VentaFactCreateSerializer
        if self.action in ('update', 'partial_update'):
            return VentaFactCabUpdateSerializer
        if self.action == 'retrieve':
            return VentaFactCabDetalleSerializer
        return VentaFactCabListSerializer

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        ser = VentaFactCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            timbrado = Timbrado.objects.get(pk=data['timbrado'], is_deleted=False)
        except Timbrado.DoesNotExist:
            raise ValidationError({'timbrado': 'Timbrado no encontrado.'})

        hoy = date.today()
        if not (timbrado.inicio_vigencia <= hoy <= timbrado.fin_vigencia):
            raise ValidationError({'timbrado': 'El timbrado no está vigente.'})

        nro = data['nro_comprobante']
        if not (timbrado.nro_desde <= nro <= timbrado.nro_hasta):
            raise ValidationError({'nro_comprobante': f'Número fuera del rango del timbrado ({timbrado.nro_desde}–{timbrado.nro_hasta}).'})

        if VentaFactCab.objects.filter(timbrado=timbrado, nro_comprobante=nro, is_deleted=False).exists():
            raise ValidationError({'nro_comprobante': 'Este número de comprobante ya está en uso.'})

        items_data = []
        for det in data['detalle']:
            try:
                prod = ProductoServicio.objects.get(pk=det['prs'], is_deleted=False)
            except ProductoServicio.DoesNotExist:
                raise ValidationError({'detalle': f'Producto ID {det["prs"]} no encontrado.'})

            calcs = calcular_item(det['monto'], prod.impuesto)
            items_data.append({
                'prod': prod,
                'cantidad': det['cantidad'],
                'monto': det['monto'],
                'impuesto': prod.impuesto,
                'calcs': calcs,
            })

        totales = calcular_totales([it['calcs'] for it in items_data])

        vuelto = Decimal('0')
        if data['condicion_vta'] and data.get('cobranza'):
            total_cobrado = sum(Decimal(str(c['monto'])) for c in data['cobranza'])
            vuelto = max(Decimal('0'), total_cobrado - totales['monto_total'])

        try:
            persona = Persona.objects.get(pk=data['persona'], is_deleted=False)
        except Persona.DoesNotExist:
            raise ValidationError({'persona': 'Persona no encontrada.'})

        cab = VentaFactCab.objects.create(
            fecha           = data['fecha'],
            condicion_vta   = data['condicion_vta'],
            persona         = persona,
            timbrado        = timbrado,
            establecimiento = str(timbrado.punto_sucursal).zfill(3),
            expedicion      = str(timbrado.punto_expedicion).zfill(3),
            observacion     = data.get('observacion', ''),
            nro_comprobante = nro,
            vuelto          = vuelto,
            id_usu_creator  = request.user,
            **totales,
        )

        for it in items_data:
            VentaFactDet.objects.create(
                vfc            = cab,
                prs            = it['prod'],
                cantidad       = it['cantidad'],
                monto          = it['monto'],
                impuesto       = it['impuesto'],
                id_usu_creator = request.user,
                **it['calcs'],
            )

        if data['condicion_vta']:
            for cobr in data.get('cobranza', []):
                try:
                    fp  = FormaPago.objects.get(pk=cobr['forma_pago'])
                    cta = CuentaMcb.objects.get(pk=cobr['cta'], is_deleted=False)
                except (FormaPago.DoesNotExist, CuentaMcb.DoesNotExist) as e:
                    raise ValidationError({'cobranza': str(e)})

                det_cobr = VentaFactDetCobranza.objects.create(
                    vfc             = cab,
                    forma_pago      = fp,
                    cta             = cta,
                    monto           = cobr['monto'],
                    voucher         = cobr.get('voucher', ''),
                    nro_comprobante = cobr.get('nro_comprobante', ''),
                    id_usu_creator  = request.user,
                )

                MovimientoCajaBanco.objects.create(
                    cta            = cta,
                    fecha          = data['fecha'],
                    voucher        = cobr.get('voucher', '') or None,
                    monto_ingreso  = cobr['monto'],
                    monto_egreso   = Decimal('0'),
                    vuelto         = Decimal('0'),
                    vfdc_id        = det_cobr.id,
                    id_usu_creator = request.user,
                )
        else:
            cfg  = data['cuotas']
            cant = cfg['cant_cuota']
            dias = cfg['dias_entre_cuotas']
            mt   = totales['monto_total']
            mc   = (mt / cant).quantize(Decimal('0.01'))

            for i in range(1, cant + 1):
                fecha_venc = data['fecha'] + timedelta(days=dias * i)
                CtaCobrar.objects.create(
                    vfc               = cab,
                    nro_cuota         = i,
                    cant_cuota        = cant,
                    monto_total       = mt,
                    monto_cuota       = mc,
                    saldo             = mc,
                    fecha_vencimiento = fecha_venc,
                    estado            = 'pendiente',
                    id_usu_creator    = request.user,
                )

        out = VentaFactCabDetalleSerializer(cab)
        return Response(out.data, status=201)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        ser = VentaFactCabUpdateSerializer(instance, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        self.perform_update(ser)
        instance.refresh_from_db()
        return Response(VentaFactCabDetalleSerializer(instance).data)

    def perform_destroy(self, instance):
        cobr_ids = list(instance.cobranza.filter(is_deleted=False).values_list('id', flat=True))
        if MovimientoCajaBanco.objects.filter(vfdc_id__in=cobr_ids, is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: tiene movimientos de caja vinculados.')

        now  = timezone.now()
        user = self.request.user
        instance.detalle.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )
        instance.cobranza.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )
        instance.cuotas.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )
        super().perform_destroy(instance)

    @action(detail=False, methods=['post'], url_path='validar-timbrado')
    def validar_timbrado(self, request):
        estab      = request.data.get('establecimiento', '').strip()
        expedicion = request.data.get('expedicion', '').strip()
        numero     = request.data.get('numero')

        if not all([estab, expedicion, numero is not None]):
            return Response({'valido': False, 'mensaje': 'Datos incompletos.'}, status=400)

        hoy = date.today()
        try:
            numero = int(numero)
        except (ValueError, TypeError):
            return Response({'valido': False, 'mensaje': 'Número inválido.'}, status=400)

        qs = Timbrado.objects.filter(
            punto_sucursal=estab,
            punto_expedicion=expedicion,
            inicio_vigencia__lte=hoy,
            fin_vigencia__gte=hoy,
            is_deleted=False,
        )
        if not qs.exists():
            return Response({
                'valido': False,
                'mensaje': f'No hay timbrado vigente para {estab}-{expedicion}.',
                'timbrado_id': None,
            })

        timbrado = qs.order_by('-inicio_vigencia').first()

        if not (timbrado.nro_desde <= numero <= timbrado.nro_hasta):
            return Response({
                'valido': False,
                'mensaje': f'Número fuera del rango habilitado ({timbrado.nro_desde}–{timbrado.nro_hasta}).',
                'timbrado_id': timbrado.id,
            })

        if VentaFactCab.objects.filter(timbrado=timbrado, nro_comprobante=numero, is_deleted=False).exists():
            return Response({
                'valido': False,
                'mensaje': 'Este número ya fue utilizado.',
                'timbrado_id': timbrado.id,
            })

        return Response({
            'valido':       True,
            'timbrado_id':  timbrado.id,
            'nro_timbrado': timbrado.nro_timbrado,
            'mensaje':      f'Timbrado {timbrado.nro_timbrado} válido.',
        })

    @action(detail=False, methods=['get'], url_path='siguiente-numero')
    def siguiente_numero(self, request):
        estab      = request.query_params.get('establecimiento', '').strip()
        expedicion = request.query_params.get('expedicion', '').strip()

        if not estab or not expedicion:
            return Response({'error': 'Se requieren establecimiento y expedicion.'}, status=400)

        hoy = date.today()
        qs = Timbrado.objects.filter(
            punto_sucursal=estab,
            punto_expedicion=expedicion,
            inicio_vigencia__lte=hoy,
            fin_vigencia__gte=hoy,
            is_deleted=False,
        )
        if not qs.exists():
            return Response({'error': 'No hay timbrado vigente para ese punto de emisión.'}, status=404)

        timbrado = qs.order_by('-inicio_vigencia').first()

        max_usado = VentaFactCab.objects.filter(
            timbrado=timbrado, is_deleted=False,
        ).aggregate(max_nro=Max('nro_comprobante'))['max_nro']

        siguiente = (max_usado if max_usado is not None else timbrado.nro_desde - 1) + 1

        if siguiente > timbrado.nro_hasta:
            return Response({'error': 'El timbrado ha alcanzado el límite de comprobantes.'}, status=400)

        return Response({
            'timbrado_id':  timbrado.id,
            'nro_timbrado': timbrado.nro_timbrado,
            'siguiente':    siguiente,
        })

    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[AllowAny])
    def pdf(self, request, pk=None):
        try:
            factura = (
                VentaFactCab.objects
                .select_related('persona', 'timbrado')
                .prefetch_related('detalle__prs', 'cobranza')
                .get(pk=pk, is_deleted=False)
            )
        except VentaFactCab.DoesNotExist:
            return HttpResponse('Factura no encontrada.', status=404)

        estab = factura.establecimiento or str(factura.timbrado.punto_sucursal).zfill(3)
        expd  = factura.expedicion or str(factura.timbrado.punto_expedicion).zfill(3)
        nro_formateado = f'{estab}-{expd}-{str(factura.nro_comprobante).zfill(7)}'

        detalle = list(factura.detalle.filter(is_deleted=False).select_related('prs'))

        for item in detalle:
            try:
                from decimal import Decimal as D
                item.precio_unitario = (D(str(item.monto)) / D(str(item.cantidad))).quantize(D('1'))
            except Exception:
                item.precio_unitario = item.monto

        MIN_FILAS    = 8
        filas_vacias = range(max(0, MIN_FILAS - len(detalle)))

        contexto = {
            'factura':        factura,
            'detalle':        detalle,
            'nro_formateado': nro_formateado,
            'condicion':      'Contado' if factura.condicion_vta else 'Crédito',
            'filas_vacias':   filas_vacias,
        }

        html = render_to_string('informes/factura_print.html', contexto, request=request)

        try:
            import weasyprint
            pdf_bytes = weasyprint.HTML(string=html, base_url=request.build_absolute_uri('/')).write_pdf()
        except Exception as e:
            return HttpResponse(f'Error generando PDF: {e}', status=500)

        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="factura_{nro_formateado}.pdf"'
        return response
