from datetime import date
from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from .models import Timbrado
from .serializers import TimbradoSerializer


class TimbradoViewSet(viewsets.ModelViewSet):
    serializer_class   = TimbradoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.SearchFilter, filters.OrderingFilter]
    search_fields      = ['nro_timbrado', 'nro_habilitacion']
    ordering_fields    = ['nro_timbrado', 'inicio_vigencia', 'fin_vigencia']
    ordering           = ['-inicio_vigencia']

    def get_queryset(self):
        qs     = Timbrado.objects.filter(is_deleted=False)
        hoy    = date.today()
        vigente = self.request.query_params.get('vigente')

        if vigente == 'true':
            qs = qs.filter(inicio_vigencia__lte=hoy, fin_vigencia__gte=hoy)
        elif vigente == 'false':
            qs = qs.exclude(inicio_vigencia__lte=hoy, fin_vigencia__gte=hoy)

        return qs

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        # PENDIENTE: descomentar cuando exista el modelo Factura
        # from apps.facturacion.models import Factura
        # if Factura.objects.filter(timbrado=instance, is_deleted=False).exists():
        #     raise ValidationError('No se puede eliminar un timbrado con facturas emitidas.')

        instance.is_deleted         = True
        instance.fecha_eliminacion  = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Timbrado.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
