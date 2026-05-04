from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.db.models import Count, Q

from apps.administracion.auditoria.mixins import AuditoriaMixin
from .models import Grupo, ProductoServicio
from .serializers import (
    GrupoListSerializer, GrupoSerializer,
    ProductoServicioListSerializer, ProductoServicioSerializer,
)


class GrupoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['descripcion']
    ordering_fields    = ['descripcion', 'activo']
    ordering           = ['descripcion']

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve', 'eliminados']:
            return GrupoListSerializer
        return GrupoSerializer

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

    def perform_destroy(self, instance):
        if instance.productos.filter(is_deleted=False, activo=True).exists():
            raise ValidationError('No se puede eliminar un grupo con productos activos vinculados.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Grupo.objects.filter(is_deleted=True).annotate(
            total_productos=Count('productos', filter=Q(productos__is_deleted=False))
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class ProductoServicioViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['descripcion']
    ordering_fields    = ['descripcion', 'impuesto', 'activo']
    ordering           = ['descripcion']

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve', 'eliminados']:
            return ProductoServicioListSerializer
        return ProductoServicioSerializer

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

    def perform_destroy(self, instance):
        # TODO: verificar facturas cuando se implemente el módulo de facturación
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = ProductoServicio.objects.filter(is_deleted=True).select_related('grupo')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
