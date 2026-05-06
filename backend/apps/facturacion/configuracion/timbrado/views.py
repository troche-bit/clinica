from django.utils import timezone
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.administracion.auditoria.mixins import AuditoriaMixin
from apps.core.permissions import IsAdminRole
from config.pagination import StandardPagination
from .models import Timbrado
from .serializers import TimbradoSerializer, TimbradoListSerializer


class TimbradoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    pagination_class = StandardPagination
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ['nro_timbrado', 'nro_habilitacion']
    ordering_fields  = ['nro_timbrado', 'inicio_vigencia', 'fin_vigencia']
    ordering         = ['-inicio_vigencia']

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsAuthenticated(), IsAdminRole()]

    def get_queryset(self):
        qs      = Timbrado.objects.filter(is_deleted=False)
        hoy     = timezone.localtime().date()
        vigente = self.request.query_params.get('vigente')

        if vigente == 'true':
            qs = qs.filter(inicio_vigencia__lte=hoy, fin_vigencia__gte=hoy)
        elif vigente == 'false':
            qs = qs.exclude(inicio_vigencia__lte=hoy, fin_vigencia__gte=hoy)

        return qs

    def get_serializer_class(self):
        if self.action in ('list', 'retrieve', 'eliminados'):
            return TimbradoListSerializer
        return TimbradoSerializer

    def perform_destroy(self, instance):
        from apps.facturacion.ventas.models import VentaFactCab
        if VentaFactCab.objects.filter(timbrado=instance, is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: el timbrado tiene facturas emitidas.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Timbrado.objects.filter(is_deleted=True).order_by('-fecha_eliminacion')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(self.get_serializer(qs, many=True).data)
