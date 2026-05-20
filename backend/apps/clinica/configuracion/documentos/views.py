import os
from django.conf import settings
from django.http import FileResponse
from django.db.models import Count, Q
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from .models import DocumentoDigPaciente, DocumentoDigPrestador, build_storage_path, build_storage_path_prestador
from .serializers import (
    DocumentoDigPacienteSerializer, DocumentoDigPacienteListSerializer,
    DocumentoDigPrestadorSerializer, DocumentoDigPrestadorListSerializer,
)
from config.pagination import StandardPagination
from apps.administracion.auditoria.mixins import AuditoriaMixin

EXTENSIONES_PERMITIDAS = {'pdf', 'jpg', 'jpeg', 'png'}

MIME_MAP = {
    'pdf':  'application/pdf',
    'jpg':  'image/jpeg',
    'jpeg': 'image/jpeg',
    'png':  'image/png',
}


class DocumentoDigPacienteViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['fecha_creacion']
    ordering           = ['-fecha_creacion']

    def get_queryset(self):
        qs = DocumentoDigPaciente.objects.filter(is_deleted=False).select_related(
            'paciente__persona',
            'tipo_doc_dig',
            'consulta',
        )

        params   = self.request.query_params
        paciente = params.get('paciente')
        consulta = params.get('consulta')

        if paciente:
            qs = qs.filter(paciente_id=paciente)
        if consulta:
            qs = qs.filter(consulta_id=consulta)

        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve', 'eliminados']:
            return DocumentoDigPacienteListSerializer
        return DocumentoDigPacienteSerializer

    def perform_create(self, serializer):
        archivo      = self.request.FILES.get('archivo')
        tipo_doc_dig = serializer.validated_data.get('tipo_doc_dig')
        paciente     = serializer.validated_data.get('paciente')

        if not archivo:
            raise ValidationError({'archivo': 'El archivo es requerido.'})

        filename_original = archivo.name
        ext = filename_original.rsplit('.', 1)[-1].lower() if '.' in filename_original else ''

        if ext not in EXTENSIONES_PERMITIDAS:
            raise ValidationError(
                {'archivo': 'Extension no permitida. Solo se aceptan: ' + ', '.join(sorted(EXTENSIONES_PERMITIDAS)) + '.'}
            )

        storage_path = build_storage_path(tipo_doc_dig, paciente.id, filename_original)
        full_path    = os.path.join(settings.MEDIA_ROOT, storage_path)

        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'wb+') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        serializer.validated_data['storage']  = storage_path
        serializer.validated_data['filename'] = filename_original
        super().perform_create(serializer)

    def perform_destroy(self, instance):
        # El archivo físico se elimina antes del borrado lógico para evitar
        # archivos huérfanos en disco si el borrado lógico fallara.
        full_path = os.path.join(settings.MEDIA_ROOT, instance.storage)
        if os.path.exists(full_path):
            os.remove(full_path)
            dir_path = os.path.dirname(full_path)
            try:
                if not os.listdir(dir_path):
                    os.rmdir(dir_path)
            except OSError:
                pass
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = DocumentoDigPaciente.objects.filter(is_deleted=True).select_related(
            'paciente__persona',
            'tipo_doc_dig',
        ).order_by('-fecha_eliminacion')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='pacientes')
    def pacientes_con_documentos(self, request):
        from apps.clinica.paciente.models import Paciente

        search = request.query_params.get('search', '').strip()

        paciente_ids = (
            DocumentoDigPaciente.objects
            .filter(is_deleted=False)
            .values_list('paciente_id', flat=True)
            .distinct()
        )

        qs = (
            Paciente.objects
            .filter(id__in=paciente_ids, is_deleted=False)
            .select_related('persona')
            .annotate(
                cantidad_documentos=Count(
                    'documentos', filter=Q(documentos__is_deleted=False)
                )
            )
            .order_by('persona__razon_social')
        )

        if search:
            qs = qs.filter(
                Q(persona__razon_social__icontains=search) |
                Q(persona__nro_documento__icontains=search)
            )

        data = [
            {
                'id':                  p.id,
                'nombre':              p.persona.razon_social,
                'nro_documento':       p.persona.nro_documento,
                'cantidad_documentos': p.cantidad_documentos,
            }
            for p in qs
        ]
        return Response(data)

    @action(detail=True, methods=['get'], url_path='descargar')
    def descargar(self, request, pk=None):
        documento = self.get_object()
        full_path = os.path.join(settings.MEDIA_ROOT, documento.storage)

        if not os.path.exists(full_path):
            return Response({'error': 'Archivo no encontrado en el servidor.'}, status=404)

        ext          = documento.filename.rsplit('.', 1)[-1].lower() if '.' in documento.filename else ''
        content_type = MIME_MAP.get(ext, 'application/octet-stream')

        return FileResponse(
            open(full_path, 'rb'),
            content_type=content_type,
            as_attachment=False,
            filename=documento.filename,
        )


class DocumentoDigPrestadorViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    pagination_class   = StandardPagination
    permission_classes = [IsAuthenticated]
    filter_backends    = [filters.OrderingFilter]
    ordering_fields    = ['fecha_creacion']
    ordering           = ['-fecha_creacion']

    def get_queryset(self):
        qs = DocumentoDigPrestador.objects.filter(is_deleted=False).select_related(
            'persona_rrhh__persona',
            'tipo_doc_dig',
        )
        persona_rrhh = self.request.query_params.get('persona_rrhh')
        if persona_rrhh:
            qs = qs.filter(persona_rrhh_id=persona_rrhh)
        return qs

    def get_serializer_class(self):
        if self.action in ['list', 'retrieve', 'eliminados']:
            return DocumentoDigPrestadorListSerializer
        return DocumentoDigPrestadorSerializer

    def perform_create(self, serializer):
        archivo      = self.request.FILES.get('archivo')
        tipo_doc_dig = serializer.validated_data.get('tipo_doc_dig')
        persona_rrhh = serializer.validated_data.get('persona_rrhh')

        if not archivo:
            raise ValidationError({'archivo': 'El archivo es requerido.'})

        filename_original = archivo.name
        ext = filename_original.rsplit('.', 1)[-1].lower() if '.' in filename_original else ''

        if ext not in EXTENSIONES_PERMITIDAS:
            raise ValidationError(
                {'archivo': 'Extension no permitida. Solo se aceptan: ' + ', '.join(sorted(EXTENSIONES_PERMITIDAS)) + '.'}
            )

        storage_path = build_storage_path_prestador(tipo_doc_dig, persona_rrhh.id, filename_original)
        full_path    = os.path.join(settings.MEDIA_ROOT, storage_path)

        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        with open(full_path, 'wb+') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        serializer.validated_data['storage']  = storage_path
        serializer.validated_data['filename'] = filename_original
        super().perform_create(serializer)

    def perform_destroy(self, instance):
        full_path = os.path.join(settings.MEDIA_ROOT, instance.storage)
        if os.path.exists(full_path):
            os.remove(full_path)
            dir_path = os.path.dirname(full_path)
            try:
                if not os.listdir(dir_path):
                    os.rmdir(dir_path)
            except OSError:
                pass
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'], url_path='eliminados')
    def eliminados(self, request):
        qs = DocumentoDigPrestador.objects.filter(is_deleted=True).select_related(
            'persona_rrhh__persona',
            'tipo_doc_dig',
        ).order_by('-fecha_eliminacion')
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='descargar')
    def descargar(self, request, pk=None):
        documento = self.get_object()
        full_path = os.path.join(settings.MEDIA_ROOT, documento.storage)

        if not os.path.exists(full_path):
            return Response({'error': 'Archivo no encontrado en el servidor.'}, status=404)

        ext          = documento.filename.rsplit('.', 1)[-1].lower() if '.' in documento.filename else ''
        content_type = MIME_MAP.get(ext, 'application/octet-stream')

        return FileResponse(
            open(full_path, 'rb'),
            content_type=content_type,
            as_attachment=False,
            filename=documento.filename,
        )
