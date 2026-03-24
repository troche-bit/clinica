from rest_framework import viewsets, filters # Importamos las clases necesarias de DRF
from rest_framework.permissions import IsAuthenticated # Importamos la clase de permisos para requerir autenticación
from .models import TipoDocumento, Persona # Importamos los modelos que vamos a usar
from .serializers import TipoDocumentoSerializer, PersonaSerializer # Importamos los serializers que hemos creado
from rest_framework.decorators import action # Importamos el decorador para acciones personalizadas
from rest_framework.response import Response # Importamos la clase para construir respuestas HTTP
from drf_spectacular.utils import extend_schema, OpenApiParameter # Importamos utilidades para la documentación de la API
from apps.paciente.models import Paciente # Importamos el modelo de Paciente para verificar si una persona es paciente
from apps.paciente.serializers import PacienteSerializer    #Importamos el serialicer de paciente

class TipoDocumentoViewSet(viewsets.ModelViewSet):
    queryset = TipoDocumento.objects.all() # Definimos el queryset para este viewset
    serializer_class = TipoDocumentoSerializer # Especificamos el serializer a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado
    filter_backends = [filters.SearchFilter] # Agregamos la capacidad de búsqueda
    search_fields = ['descripcion'] # Especificamos los campos por los que se puede buscar

class PersonaViewSet(viewsets.ModelViewSet):
    serializer_class = PersonaSerializer # Especificamos el serializer a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos la capacidad de búsqueda y ordenamiento
    search_fields = ['razon_social', 'nro_documento', 'correo_electronico'] # Especificamos los campos por los que se puede buscar
    ordering_fields = ['razon_social', 'fecha_creacion'] # Especificamos los campos por los que se puede ordenar

    def get_queryset(self):
        return Persona.objects.filter(
            is_deleted=False
            ).select_related('tipo_documento', 'pais', 'departamento', 'ciudad') # Definimos el queryset para este viewset, excluyendo los registros marcados como eliminados y optimizando las consultas relacionadas
    
    def perform_destroy(self, instance):

        from django.utils import timezone # Importamos timezone para obtener la fecha y hora actual
        instance.is_deleted = True # Marcamos el registro como eliminado
        instance.fecha_eliminacion = timezone.now() # Guardamos la fecha y hora de eliminación
        instance.save() # Guardamos los cambios en la base de datos
    
    @extend_schema( # Decorador para extender la documentación de esta acción personalizada
        parameters=[ # Definimos los parámetros que esta acción personalizada acepta
            OpenApiParameter( 
                name='nro_documento',
                type=str,
                description='Número de documento a buscar',
                required=True
            )
        ]
    )

    @action(detail=False, methods=['get'], url_path='buscar') # Decorador para definir una acción personalizada en el viewset
    def buscar(self, request):
        nro_documento = request.query_params.get('nro_documento') # Obtenemos el número de documento de los parámetros de la consulta
        if not nro_documento:
            return Response(
                {
                    'error': 'nro_documento es requerido'

                }, status=400
            )
        try:
            persona = Persona.objects.get(nro_documento=nro_documento, is_deleted=False) # Intentamos obtener la persona con el número de documento proporcionado, asegurándonos de que no esté marcada como eliminada
            serializer = PersonaSerializer(persona) # Serializamos la persona encontrada
            #es_paciente = hasattr(persona, 'paciente') # Verificamos si la persona tiene un paciente asociado
            try:
                paciente = Paciente.objects.get(persona=persona, is_deleted=False)
                paciente_data = PacienteSerializer(paciente).data
                es_paciente = True
            except Paciente.DoesNotExist:
                paciente_data = None
                es_paciente = False
            return Response({
                'persona': serializer.data,
                'paciente': paciente_data,
                'es_paciente': es_paciente
            })
        except Persona.DoesNotExist:
            return Response(
                { 'persona': None, 'paciente': None, 'es_paciente': False }, status=200 # Si no se encuentra la persona, devolvemos un error 200
            )