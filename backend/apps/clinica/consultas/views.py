from datetime import date
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import Consulta
from .serializers import ConsultaSerializer, ConsultaListSerializer
from config.pagination import StandardPagination
from apps.administracion.auditoria.mixins import AuditoriaMixin


class ConsultaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['agenda__fecha', 'hora_desde']
    ordering           = ['-agenda__fecha', 'hora_desde']

    def get_queryset(self):
        qs = Consulta.objects.filter(is_deleted=False).select_related(
            'agenda__horario_prestador__persona_rrhh__persona',
            'agenda__paciente__persona',
            'agenda__paciente__responsable__persona',
            'evento_clinico',
        ).prefetch_related(
            'agenda__horario_prestador__especialidades',
        )

        params = self.request.query_params

        persona_rrhh = params.get('persona_rrhh')
        fecha        = params.get('fecha')
        estado       = params.get('estado')
        paciente     = params.get('paciente')

        if persona_rrhh:
            qs = qs.filter(agenda__horario_prestador__persona_rrhh_id=persona_rrhh)
        if fecha:
            qs = qs.filter(agenda__fecha=fecha)
        if estado:
            qs = qs.filter(estado=estado)
        if paciente:
            qs = qs.filter(agenda__paciente_id=paciente)

        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve', 'eliminados']:
            return ConsultaListSerializer
        return ConsultaSerializer

    def perform_create(self, serializer):
        agenda = serializer.validated_data.get('agenda')

        if agenda.estado != 'ocupado':
            raise ValidationError(
                {'agenda': 'Solo se puede crear una consulta para un turno ocupado. Estado actual: ' + str(agenda.estado) + '.'}
            )

        if Consulta.objects.filter(agenda=agenda, is_deleted=False).exists():
            raise ValidationError(
                {'agenda': 'Ya existe una consulta activa para este turno.'}
            )

        super().perform_create(serializer)

    def perform_destroy(self, instance):
        from apps.clinica.configuracion.documentos.models import DocumentoDigPaciente
        if DocumentoDigPaciente.objects.filter(consulta=instance, is_deleted=False).exists():
            raise ValidationError('No se puede eliminar: la consulta tiene documentos asociados.')
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = Consulta.objects.filter(is_deleted=True).select_related(
            'agenda__horario_prestador__persona_rrhh__persona',
            'agenda__paciente__persona',
            'evento_clinico',
        ).order_by('-fecha_eliminacion')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='iniciar')
    def iniciar(self, request, pk=None):
        consulta = self.get_object()

        if consulta.estado != Consulta.Estado.EN_ESPERA:
            raise ValidationError(
                {'estado': 'Solo se puede iniciar una consulta en espera. Estado actual: ' + str(consulta.estado) + '.'}
            )

        consulta.estado             = Consulta.Estado.EN_CONSULTA
        consulta.hora_desde         = timezone.now().time()
        consulta.id_usu_modificator = request.user
        consulta.save()

        return Response(ConsultaListSerializer(consulta).data)

    @action(detail=True, methods=['post'], url_path='finalizar')
    def finalizar(self, request, pk=None):
        consulta = self.get_object()

        if consulta.estado != Consulta.Estado.EN_CONSULTA:
            raise ValidationError(
                {'estado': 'Solo se puede finalizar una consulta en curso. Estado actual: ' + str(consulta.estado) + '.'}
            )

        consulta.estado             = Consulta.Estado.FINALIZADA
        consulta.hora_hasta         = timezone.now().time()
        consulta.id_usu_modificator = request.user
        consulta.save()

        from apps.clinica.agenda.models import Agenda
        agenda = consulta.agenda
        agenda.estado             = Agenda.Estado.REALIZADO
        agenda.id_usu_modificator = request.user
        agenda.save()

        return Response(ConsultaListSerializer(consulta).data)

    @action(detail=False, methods=['get'], url_path='stats-hoy')
    def stats_hoy(self, request):
        hoy = date.today()
        qs  = Consulta.objects.filter(agenda__fecha=hoy, is_deleted=False)
        return Response({
            'total':       qs.count(),
            'en_espera':   qs.filter(estado=Consulta.Estado.EN_ESPERA).count(),
            'en_consulta': qs.filter(estado=Consulta.Estado.EN_CONSULTA).count(),
            'finalizadas': qs.filter(estado=Consulta.Estado.FINALIZADA).count(),
        })
