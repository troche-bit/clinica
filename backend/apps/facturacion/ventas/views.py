from datetime import timedelta
from decimal import Decimal

from django.db import models, transaction
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
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from apps.facturacion.configuracion.timbrado.models import Timbrado
from apps.stock.productos.models import ProductoServicio
from apps.forma_pago.models import FormaPago
from apps.finanzas.caja_banco.models import CuentaMcb, MovimientoCajaBanco
from apps.finanzas.cobranzas.models import CobranzaDet
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
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['persona__razon_social', 'persona__nro_documento', 'nro_comprobante']
    ordering_fields    = ['fecha', 'monto_total', 'fecha_creacion']
    ordering           = ['-fecha', '-fecha_creacion']

    def get_permissions(self):
        if self.action == 'pdf':
            return [AllowAny()]
        if self.action in ('list', 'retrieve', 'validar_timbrado', 'siguiente_numero', 'reporte_pdf', 'reporte_excel'):
            return [IsAuthenticated()]
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

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

        hoy = timezone.localtime().date()
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
                prod = ProductoServicio.objects.get(pk=det['prs'], is_deleted=False, activo=True)
            except ProductoServicio.DoesNotExist:
                raise ValidationError({'detalle': f'Producto ID {det["prs"]} no encontrado o inactivo.'})

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
            monto_pendiente = totales['monto_total']
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

                monto_mov = min(Decimal(str(cobr['monto'])), monto_pendiente)
                if monto_mov > 0:
                    MovimientoCajaBanco.objects.create(
                        cta             = cta,
                        fecha           = data['fecha'],
                        nro_comprobante = cobr.get('nro_comprobante', '') or None,
                        monto_ingreso   = monto_mov,
                        monto_egreso    = Decimal('0'),
                        vuelto          = Decimal('0'),
                        vfdc_id         = det_cobr.id,
                        id_usu_creator  = request.user,
                    )
                    monto_pendiente -= monto_mov
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

    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()

        if 'detalle' in request.data:
            return self._full_update(request, instance)

        ser = VentaFactCabUpdateSerializer(instance, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        self.perform_update(ser)
        instance.refresh_from_db()
        return Response(VentaFactCabDetalleSerializer(instance).data)

    def _full_update(self, request, instance):
        # Permite cambiar condicion_vta en edición; si no viene en el request, mantiene la original
        raw_cond = request.data.get('condicion_vta', instance.condicion_vta)
        if isinstance(raw_cond, str):
            nueva_condicion = raw_cond.lower() in ('true', '1')
        else:
            nueva_condicion = bool(raw_cond)

        # Si la condición original era crédito, bloquear si hay cobros registrados en el módulo de cobranzas
        if not instance.condicion_vta:
            cobros_qs = CobranzaDet.objects.filter(
                cta_cobrar__vfc=instance, is_deleted=False, cobranza__is_deleted=False
            )
            if cobros_qs.exists():
                nros = list(cobros_qs.values_list('cobranza__comprobante_nro', flat=True).distinct())
                nros_str = ', '.join(str(n) for n in nros if n is not None)
                raise ValidationError({
                    'detail': f'No se puede editar: el comprobante tiene cobros registrados (Cobranza N° {nros_str}). Elimine la cobranza para poder modificarlo.'
                })

            tiene_pagos = (
                instance.cuotas.filter(is_deleted=False, estado='pagado').exists()
                or instance.cuotas.filter(is_deleted=False).exclude(saldo=models.F('monto_cuota')).exists()
            )
            if tiene_pagos:
                raise ValidationError({'detail': 'No se puede editar: ya existen cuotas cobradas en este comprobante.'})

        # Determinar establecimiento, expedición y timbrado (pueden cambiar en edición)
        estab      = request.data.get('establecimiento', instance.establecimiento)
        expedicion = request.data.get('expedicion',     instance.expedicion)

        if estab != instance.establecimiento or expedicion != instance.expedicion:
            hoy = timezone.localtime().date()
            timbrado = Timbrado.objects.filter(
                punto_sucursal=estab,
                punto_expedicion=expedicion,
                inicio_vigencia__lte=hoy,
                fin_vigencia__gte=hoy,
                is_deleted=False,
            ).order_by('-inicio_vigencia').first()
            if not timbrado:
                raise ValidationError({'establecimiento': f'No hay timbrado vigente para {estab}-{expedicion}.'})
        else:
            timbrado = instance.timbrado

        # Validar nro_comprobante
        raw_nro = request.data.get('nro_comprobante')
        if raw_nro is not None:
            try:
                nuevo_nro = int(raw_nro)
            except (ValueError, TypeError):
                raise ValidationError({'nro_comprobante': 'Número de comprobante inválido.'})
        else:
            nuevo_nro = instance.nro_comprobante

        if nuevo_nro != instance.nro_comprobante or timbrado.id != instance.timbrado_id:
            if not (timbrado.nro_desde <= nuevo_nro <= timbrado.nro_hasta):
                raise ValidationError({
                    'nro_comprobante': f'Número fuera del rango del timbrado ({timbrado.nro_desde}–{timbrado.nro_hasta}).'
                })
            if VentaFactCab.objects.filter(
                timbrado=timbrado, nro_comprobante=nuevo_nro, is_deleted=False
            ).exclude(pk=instance.pk).exists():
                raise ValidationError({'nro_comprobante': 'Este número de comprobante ya está en uso.'})

        ser = VentaFactCreateSerializer(data={
            'fecha':           request.data.get('fecha'),
            'condicion_vta':   nueva_condicion,
            'persona':         request.data.get('persona'),
            'timbrado':        timbrado.id,
            'observacion':     request.data.get('observacion', ''),
            'nro_comprobante': nuevo_nro,
            'detalle':         request.data.get('detalle', []),
            'cobranza':        request.data.get('cobranza', []),
            'cuotas':          request.data.get('cuotas'),
        })
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        now  = timezone.now()
        user = request.user

        cobr_ids = list(instance.cobranza.filter(is_deleted=False).values_list('id', flat=True))
        MovimientoCajaBanco.objects.filter(vfdc_id__in=cobr_ids, is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )
        instance.detalle.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )
        instance.cobranza.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )
        instance.cuotas.filter(is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )

        items_data = []
        for det in data['detalle']:
            try:
                prod = ProductoServicio.objects.get(pk=det['prs'], is_deleted=False, activo=True)
            except ProductoServicio.DoesNotExist:
                raise ValidationError({'detalle': f'Producto ID {det["prs"]} no encontrado o inactivo.'})
            calcs = calcular_item(det['monto'], prod.impuesto)
            items_data.append({
                'prod': prod, 'cantidad': det['cantidad'], 'monto': det['monto'],
                'impuesto': prod.impuesto, 'calcs': calcs,
            })

        totales = calcular_totales([it['calcs'] for it in items_data])

        vuelto = Decimal('0')
        if nueva_condicion and data.get('cobranza'):
            total_cobrado = sum(Decimal(str(c['monto'])) for c in data['cobranza'])
            vuelto = max(Decimal('0'), total_cobrado - totales['monto_total'])

        try:
            persona = Persona.objects.get(pk=data['persona'], is_deleted=False)
        except Persona.DoesNotExist:
            raise ValidationError({'persona': 'Persona no encontrada.'})

        instance.fecha           = data['fecha']
        instance.persona         = persona
        instance.observacion     = data.get('observacion', '')
        instance.condicion_vta   = nueva_condicion
        instance.nro_comprobante = nuevo_nro
        instance.establecimiento = estab
        instance.expedicion      = expedicion
        instance.timbrado        = timbrado
        instance.vuelto          = vuelto
        for k, v in totales.items():
            setattr(instance, k, v)
        instance.id_usu_modificator = user
        instance.save()

        for it in items_data:
            VentaFactDet.objects.create(
                vfc=instance, prs=it['prod'], cantidad=it['cantidad'],
                monto=it['monto'], impuesto=it['impuesto'],
                id_usu_creator=user, **it['calcs'],
            )

        if nueva_condicion:
            monto_pendiente = totales['monto_total']
            for cobr in data.get('cobranza', []):
                try:
                    fp  = FormaPago.objects.get(pk=cobr['forma_pago'])
                    cta = CuentaMcb.objects.get(pk=cobr['cta'], is_deleted=False)
                except (FormaPago.DoesNotExist, CuentaMcb.DoesNotExist) as e:
                    raise ValidationError({'cobranza': str(e)})
                det_cobr = VentaFactDetCobranza.objects.create(
                    vfc=instance, forma_pago=fp, cta=cta,
                    monto=cobr['monto'], voucher=cobr.get('voucher', ''),
                    nro_comprobante=cobr.get('nro_comprobante', ''),
                    id_usu_creator=user,
                )
                monto_mov = min(Decimal(str(cobr['monto'])), monto_pendiente)
                if monto_mov > 0:
                    MovimientoCajaBanco.objects.create(
                        cta=cta, fecha=data['fecha'],
                        nro_comprobante=cobr.get('nro_comprobante', '') or None,
                        monto_ingreso=monto_mov, monto_egreso=Decimal('0'),
                        vuelto=Decimal('0'), vfdc_id=det_cobr.id,
                        id_usu_creator=user,
                    )
                    monto_pendiente -= monto_mov
        else:
            cfg  = data['cuotas']
            cant = cfg['cant_cuota']
            dias = cfg['dias_entre_cuotas']
            mt   = totales['monto_total']
            mc   = (mt / cant).quantize(Decimal('0.01'))
            for i in range(1, cant + 1):
                fecha_venc = data['fecha'] + timedelta(days=dias * i)
                CtaCobrar.objects.create(
                    vfc=instance, nro_cuota=i, cant_cuota=cant,
                    monto_total=mt, monto_cuota=mc, saldo=mc,
                    fecha_vencimiento=fecha_venc, estado='pendiente',
                    id_usu_creator=user,
                )

        instance.refresh_from_db()
        return Response(VentaFactCabDetalleSerializer(instance).data)

    def perform_destroy(self, instance):
        if not instance.condicion_vta:
            cobros_qs = CobranzaDet.objects.filter(
                cta_cobrar__vfc=instance, is_deleted=False, cobranza__is_deleted=False
            )
            if cobros_qs.exists():
                nros = list(cobros_qs.values_list('cobranza__comprobante_nro', flat=True).distinct())
                nros_str = ', '.join(str(n) for n in nros if n is not None)
                raise ValidationError({
                    'detail': f'No se puede eliminar: el comprobante tiene cobros registrados (Cobranza N° {nros_str}). Elimine la cobranza primero.'
                })

        now      = timezone.now()
        user     = self.request.user
        cobr_ids = list(instance.cobranza.filter(is_deleted=False).values_list('id', flat=True))

        MovimientoCajaBanco.objects.filter(vfdc_id__in=cobr_ids, is_deleted=False).update(
            is_deleted=True, fecha_eliminacion=now, id_usu_modificator=user
        )
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

        hoy = timezone.localtime().date()
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

        hoy = timezone.localtime().date()
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

        sub_10     = (factura.grav_10 or Decimal('0')) + (factura.iva_10 or Decimal('0'))
        sub_5      = (factura.grav_5  or Decimal('0')) + (factura.iva_5  or Decimal('0'))
        sub_exenta = (factura.monto_total or Decimal('0')) - (factura.total_gravada or Decimal('0')) - (factura.total_iva or Decimal('0'))

        contexto = {
            'factura':        factura,
            'detalle':        detalle,
            'nro_formateado': nro_formateado,
            'condicion':      'Contado' if factura.condicion_vta else 'Crédito',
            'filas_vacias':   filas_vacias,
            'sub_10':         sub_10,
            'sub_5':          sub_5,
            'sub_exenta':     sub_exenta,
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

    def _qs_con_filtros(self, request):
        from django.db.models import Q
        qs          = VentaFactCab.objects.filter(is_deleted=False).select_related('persona', 'timbrado')
        search      = request.query_params.get('search', '').strip()
        fecha_desde = request.query_params.get('fecha_desde', '').strip()
        fecha_hasta = request.query_params.get('fecha_hasta', '').strip()
        condicion   = request.query_params.get('condicion_vta', '').strip()
        if search:
            qs = qs.filter(
                Q(persona__razon_social__icontains=search) |
                Q(persona__nro_documento__icontains=search) |
                Q(nro_comprobante__icontains=search)
            )
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)
        if condicion in ('true', 'false'):
            qs = qs.filter(condicion_vta=condicion == 'true')
        return qs.order_by('-fecha', '-fecha_creacion')

    def _filtros_str(self, request):
        partes      = []
        search      = request.query_params.get('search', '').strip()
        fecha_desde = request.query_params.get('fecha_desde', '').strip()
        fecha_hasta = request.query_params.get('fecha_hasta', '').strip()
        condicion   = request.query_params.get('condicion_vta', '').strip()
        if search:
            partes.append(f'Búsqueda: {search}')
        if fecha_desde:
            partes.append(f'Desde: {fecha_desde}')
        if fecha_hasta:
            partes.append(f'Hasta: {fecha_hasta}')
        if condicion == 'true':
            partes.append('Condición: Contado')
        elif condicion == 'false':
            partes.append('Condición: Crédito')
        return ' · '.join(partes) if partes else ''

    @action(detail=False, methods=['get'], url_path='reporte-pdf')
    def reporte_pdf(self, request):
        qs    = self._qs_con_filtros(request)
        filas = []
        for i, f in enumerate(qs, 1):
            estab = f.establecimiento or str(f.timbrado.punto_sucursal).zfill(3)
            expd  = f.expedicion or str(f.timbrado.punto_expedicion).zfill(3)
            filas.append({
                'nro':        i,
                'comprobante': f'{estab}-{expd}-{str(f.nro_comprobante).zfill(7)}',
                'fecha':      f.fecha,
                'cliente':    f.persona.razon_social,
                'documento':  f.persona.nro_documento,
                'condicion':  'Contado' if f.condicion_vta else 'Crédito',
                'monto_total': f.monto_total or Decimal('0'),
            })
        contexto = {
            'filas':       filas,
            'total':       len(filas),
            'fecha':       timezone.localtime().date(),
            'filtros_str': self._filtros_str(request),
        }
        html = render_to_string('informes/factura_lista.html', contexto, request=request)
        try:
            import weasyprint
            pdf_bytes = weasyprint.HTML(string=html, base_url=request.build_absolute_uri('/')).write_pdf()
        except Exception as e:
            return HttpResponse(f'Error generando PDF: {e}', status=500)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="facturas.pdf"'
        return response

    @action(detail=False, methods=['get'], url_path='reporte-excel')
    def reporte_excel(self, request):
        from io import BytesIO
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment

        qs       = self._qs_con_filtros(request)
        wb       = openpyxl.Workbook()
        ws       = wb.active
        ws.title = 'Facturas'

        headers     = ['#', 'Nro. Comprobante', 'Fecha', 'Cliente', 'Documento', 'Condición', 'Total (Gs.)']
        header_fill = PatternFill(start_color='1A3A5C', end_color='1A3A5C', fill_type='solid')
        header_font = Font(color='FFFFFF', bold=True, size=10)
        for col, h in enumerate(headers, 1):
            cell            = ws.cell(row=1, column=col, value=h)
            cell.fill       = header_fill
            cell.font       = header_font
            cell.alignment  = Alignment(horizontal='center')

        fill_par = PatternFill(start_color='F8FAFC', end_color='F8FAFC', fill_type='solid')
        for i, f in enumerate(qs, 1):
            estab = f.establecimiento or str(f.timbrado.punto_sucursal).zfill(3)
            expd  = f.expedicion or str(f.timbrado.punto_expedicion).zfill(3)
            comp  = f'{estab}-{expd}-{str(f.nro_comprobante).zfill(7)}'
            fila  = [
                i, comp, f.fecha, f.persona.razon_social, f.persona.nro_documento,
                'Contado' if f.condicion_vta else 'Crédito',
                int(f.monto_total or 0),
            ]
            for col, val in enumerate(fila, 1):
                cell = ws.cell(row=i + 1, column=col, value=val)
                if i % 2 == 0:
                    cell.fill = fill_par

        ws.column_dimensions['A'].width = 6
        ws.column_dimensions['B'].width = 18
        ws.column_dimensions['C'].width = 12
        ws.column_dimensions['D'].width = 32
        ws.column_dimensions['E'].width = 16
        ws.column_dimensions['F'].width = 12
        ws.column_dimensions['G'].width = 16

        buf = BytesIO()
        wb.save(buf)
        buf.seek(0)
        fecha_str = timezone.localtime().strftime('%Y%m%d')
        response  = HttpResponse(
            buf.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = f'attachment; filename="facturas_{fecha_str}.xlsx"'
        return response
