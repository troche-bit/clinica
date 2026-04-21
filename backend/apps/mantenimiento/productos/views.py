from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from django.db.models import Count, Q

from .models import Grupo, ProductoServicio
from .serializers import GrupoSerializer, ProductoServicioSerializer


class GrupoViewSet(viewsets.ModelViewSet):
    serializer_class   = GrupoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['descripcion']
    ordering_fields    = ['descripcion', 'activo']
    ordering           = ['descripcion']

    def get_queryset(self):
        qs = Grupo.objects.filter(is_deleted=False).annotate(
            total_productos=Count(
                'productos',
                filter=Q(productos__is_deleted=False, productos__activo=True),
            )
        )
        activo = self.request.query_params.get('activo')
        if activo == 'true':
            qs = qs.filter(activo=True)
        elif activo == 'false':
            qs = qs.filter(activo=False)
        return qs

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        if instance.productos.filter(is_deleted=False, activo=True).exists():
            raise ValidationError('No se puede eliminar un grupo con productos activos vinculados.')
        instance.is_deleted         = True
        instance.fecha_eliminacion  = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Grupo.objects.filter(is_deleted=True).annotate(
            total_productos=Count('productos', filter=Q(productos__is_deleted=False))
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class ProductoServicioViewSet(viewsets.ModelViewSet):
    serializer_class   = ProductoServicioSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['descripcion']
    ordering_fields    = ['descripcion', 'impuesto', 'activo']
    ordering           = ['descripcion']

    def get_queryset(self):
        qs = ProductoServicio.objects.filter(is_deleted=False).select_related('grupo')

        grupo_id = self.request.query_params.get('grupo')
        if grupo_id:
            qs = qs.filter(grupo_id=grupo_id)

        activo = self.request.query_params.get('activo')
        if activo == 'true':
            qs = qs.filter(activo=True)
        elif activo == 'false':
            qs = qs.filter(activo=False)

        return qs

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        # PENDIENTE: verificar facturas cuando se implemente Factura
        # from apps.facturacion.models import DetalleFactura
        # if DetalleFactura.objects.filter(producto=instance, is_deleted=False).exists():
        #     raise ValidationError('No se puede eliminar un producto referenciado en facturas.')
        instance.is_deleted         = True
        instance.fecha_eliminacion  = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = ProductoServicio.objects.filter(is_deleted=True).select_related('grupo')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
