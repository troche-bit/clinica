from decimal import Decimal
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Sum, Count, Q
from django.db.models.functions import Coalesce

from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from .models import CuentaMcb, MovimientoCajaBanco
from .serializers import (
    CuentaMcbListSerializer,
    CuentaMcbSerializer,
    MovimientoCajaBancoListSerializer,
    MovimientoCajaBancoSerializer,
)


class CuentaMcbViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ['descripcion']
    ordering_fields = ['descripcion']
    ordering        = ['descripcion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'eliminados'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve', 'eliminados'):
            return CuentaMcbListSerializer
        return CuentaMcbSerializer

    def _qs_anotado(self, deleted=False):
        return CuentaMcb.objects.filter(is_deleted=deleted).annotate(
            saldo=Coalesce(
                Sum('movimientos__monto_ingreso', filter=Q(movimientos__is_deleted=False)),
                Decimal('0'),
            ) - Coalesce(
                Sum('movimientos__monto_egreso', filter=Q(movimientos__is_deleted=False)),
                Decimal('0'),
            ),
            total_movimientos=Count('movimientos', filter=Q(movimientos__is_deleted=False)),
        )

    def get_queryset(self):
        return self._qs_anotado(deleted=False)

    def perform_destroy(self, instance):
        if instance.movimientos.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar una cuenta con movimientos activos.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        serializer = self.get_serializer(self._qs_anotado(deleted=True), many=True)
        return Response(serializer.data)


class MovimientoCajaBancoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ['nro_comprobante']
    ordering_fields = ['fecha', 'monto_ingreso', 'monto_egreso']
    ordering        = ['-fecha', '-fecha_creacion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'eliminados'):
            return [IsAuthenticated()]
        if self.action == 'destroy':
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve', 'eliminados'):
            return MovimientoCajaBancoListSerializer
        return MovimientoCajaBancoSerializer

    def get_queryset(self):
        qs = MovimientoCajaBanco.objects.filter(is_deleted=False).select_related('cta')

        cta_id = self.request.query_params.get('cta')
        if cta_id:
            qs = qs.filter(cta_id=cta_id)

        tipo = self.request.query_params.get('tipo')
        if tipo == 'ingreso':
            qs = qs.filter(monto_ingreso__gt=0)
        elif tipo == 'egreso':
            qs = qs.filter(monto_egreso__gt=0)

        fecha_desde = self.request.query_params.get('fecha_desde')
        fecha_hasta = self.request.query_params.get('fecha_hasta')
        if fecha_desde:
            qs = qs.filter(fecha__gte=fecha_desde)
        if fecha_hasta:
            qs = qs.filter(fecha__lte=fecha_hasta)

        return qs

    def perform_destroy(self, instance):
        if instance.vfdc_id or instance.vrc_id or instance.ppdc_id:
            raise ValidationError('No se puede eliminar un movimiento generado automáticamente.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = MovimientoCajaBanco.objects.filter(is_deleted=True).select_related('cta')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
