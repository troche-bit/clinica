from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Sum, Count, Q
from django.db.models.functions import Coalesce
import decimal

from .models import CuentaMcb, MovimientoCajaBanco
from .serializers import CuentaMcbSerializer, MovimientoCajaBancoSerializer


class CuentaMcbViewSet(viewsets.ModelViewSet):
    serializer_class   = CuentaMcbSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['descripcion']
    ordering_fields    = ['descripcion']
    ordering           = ['descripcion']

    def get_queryset(self):
        return CuentaMcb.objects.filter(is_deleted=False).annotate(
            saldo=Coalesce(
                Sum('movimientos__monto_ingreso', filter=Q(movimientos__is_deleted=False)),
                decimal.Decimal('0'),
            ) - Coalesce(
                Sum('movimientos__monto_egreso', filter=Q(movimientos__is_deleted=False)),
                decimal.Decimal('0'),
            ),
            total_movimientos=Count(
                'movimientos',
                filter=Q(movimientos__is_deleted=False),
            ),
        )

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        if instance.movimientos.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar una cuenta con movimientos activos.')
        instance.is_deleted         = True
        instance.fecha_eliminacion  = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = CuentaMcb.objects.filter(is_deleted=True).annotate(
            saldo=Coalesce(
                Sum('movimientos__monto_ingreso', filter=Q(movimientos__is_deleted=False)),
                decimal.Decimal('0'),
            ) - Coalesce(
                Sum('movimientos__monto_egreso', filter=Q(movimientos__is_deleted=False)),
                decimal.Decimal('0'),
            ),
            total_movimientos=Count('movimientos', filter=Q(movimientos__is_deleted=False)),
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class MovimientoCajaBancoViewSet(viewsets.ModelViewSet):
    serializer_class   = MovimientoCajaBancoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['voucher']
    ordering_fields    = ['fecha', 'monto_ingreso', 'monto_egreso']
    ordering           = ['-fecha', '-fecha_creacion']

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

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted         = True
        instance.fecha_eliminacion  = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = MovimientoCajaBanco.objects.filter(is_deleted=True).select_related('cta')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
