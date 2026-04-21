import os
from django.conf import settings
from django.http import FileResponse
from django.db.models import Count, Q
from rest_framework import viewsets, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import DocumentoDigPaciente, build_storage_path
from .serializers import DocumentoDigPacienteSerializer, DocumentoDigPacienteListSerializer
from config.pagination import StandardPagination

EXTENSIONES_PERMITIDAS = {'pdf', 'jpg', 'jpeg', 'png'}


class DocumentoDigPacienteViewSet(viewsets.ModelViewSet):
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
        if self.action in ['list', 'retrieve']:
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
                {'archivo': f'Extensión no permitida. Solo se aceptan: {", ".join(sorted(EXTENSIONES_PERMITIDAS))}.'}
            )

        storage_path = build_storage_path(tipo_doc_dig, paciente.id, filename_original)
        full_path    = os.path.join(settings.MEDIA_ROOT, storage_path)

        # Crear directorios si no existen
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Guardar el archivo
        with open(full_path, 'wb+') as destino:
            for chunk in archivo.chunks():
                destino.write(chunk)

        serializer.save(
            storage=storage_path,
            filename=filename_original,
            id_usu_creator=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    def perform_destroy(self, instance):
        # Borrado físico del archivo en disco
        full_path = os.path.join(settings.MEDIA_ROOT, instance.storage)
        if os.path.exists(full_path):
            os.remove(full_path)
            # Eliminar el directorio si quedó vacío
            dir_path = os.path.dirname(full_path)
            try:
                if not os.listdir(dir_path):
                    os.rmdir(dir_path)
            except OSError:
                pass

        # Borrado lógico en base de datos
        instance.is_deleted         = True
        instance.fecha_eliminacion  = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # ── GET /documentos/pacientes/ ───────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='pacientes')
    def pacientes_con_documentos(self, request):
        """Pacientes que tienen al menos un documento digitalizado."""
        from apps.principal.paciente.models import Paciente

        search = request.query_params.get('search', '').strip()

        # Pacientes con al menos un documento activo
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

    # ── GET /documentos/{id}/descargar/ ──────────────────────────────────────
    @action(detail=True, methods=['get'], url_path='descargar')
    def descargar(self, request, pk=None):
        documento = self.get_object()
        full_path = os.path.join(settings.MEDIA_ROOT, documento.storage)

        if not os.path.exists(full_path):
            return Response({'error': 'Archivo no encontrado en el servidor.'}, status=404)

        response = FileResponse(
            open(full_path, 'rb'),
            as_attachment=True,
            filename=documento.filename,
        )
        return response
