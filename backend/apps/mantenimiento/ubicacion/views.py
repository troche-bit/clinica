from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista
from .models import Pais, Departamento, Ciudad
from .serializers import (
    PaisListSerializer, PaisSerializer,
    DepartamentoListSerializer, DepartamentoSerializer,
    CiudadListSerializer, CiudadSerializer,
)


class PaisViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = Pais.objects.filter(is_deleted=False)
    serializer_class = PaisSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion']
    ordering_fields = ['descripcion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return PaisListSerializer
        return PaisSerializer

    def perform_destroy(self, instance):
        if instance.departamentos.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: el país tiene departamentos activos asociados.')
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: el país tiene personas activas asociadas.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Pais.objects.filter(is_deleted=True).order_by('descripcion')
        serializer = PaisListSerializer(qs, many=True)
        return Response(serializer.data)


class DepartamentoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = Departamento.objects.filter(is_deleted=False).select_related('pais')
    serializer_class = DepartamentoSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion']
    ordering_fields = ['descripcion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_queryset(self):
        qs = super().get_queryset()
        pais_id = self.request.query_params.get('pais')
        if pais_id:
            qs = qs.filter(pais_id=pais_id)
        return qs

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return DepartamentoListSerializer
        return DepartamentoSerializer

    def perform_destroy(self, instance):
        if instance.ciudades.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: el departamento tiene ciudades activas asociadas.')
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: el departamento tiene personas activas asociadas.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Departamento.objects.filter(is_deleted=True).select_related('pais').order_by('descripcion')
        serializer = DepartamentoListSerializer(qs, many=True)
        return Response(serializer.data)


class CiudadViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = Ciudad.objects.filter(is_deleted=False).select_related('departamento__pais')
    serializer_class = CiudadSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['descripcion']
    ordering_fields = ['descripcion']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        if self.action in ('destroy', 'eliminados'):
            return [IsAuthenticated(), IsAdminRole()]
        return [IsAuthenticated(), IsAdminOrRecepcionista()]

    def get_queryset(self):
        qs = super().get_queryset()
        departamento_id = self.request.query_params.get('departamento')
        if departamento_id:
            qs = qs.filter(departamento_id=departamento_id)
        return qs

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve'):
            return CiudadListSerializer
        return CiudadSerializer

    def perform_destroy(self, instance):
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: la ciudad tiene personas activas asociadas.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Ciudad.objects.filter(is_deleted=True).select_related('departamento__pais').order_by('descripcion')
        serializer = CiudadListSerializer(qs, many=True)
        return Response(serializer.data)
