from rest_framework import viewsets, filters # Importamos los módulos necesarios de Django REST Framework
from rest_framework.permissions import IsAuthenticated # Importamos el permiso de autenticación
from rest_framework.response import Response # Importamos la clase Response para enviar respuestas HTTP
from rest_framework.decorators import action # Importamos el decorador action para crear acciones personalizadas
from django.utils import timezone # Importamos el módulo timezone para manejar fechas y horas
from .models import Paciente # Importamos el modelo Paciente
from .serializers import PacienteSerializer, PacienteListSerializer # Importamos los serializers para el modelo Paciente
from config.pagination import StandardPagination # Importamos la clase de paginación personalizada

class PacienteViewSet(viewsets.ModelViewSet): # Creamos una vista de conjunto para el modelo Paciente
    pagination_class = StandardPagination # Usamos la clase de paginación personalizada
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado para acceder a esta vista
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos filtros de búsqueda y ordenamiento
    search_fields = ['persona__razon_social', 'persona__nro_documento'] # Especificamos los campos por los que se puede buscar
    ordering_fields = ['persona__razon_social', 'fecha_creacion'] # Especificamos los campos por los que se puede ordenar

    def get_queryset(self): # Sobrescribimos el método get_queryset para personalizar la consulta
        return Paciente.objects.filter(
            is_deleted=False
            ).select_related(
                'persona__tipo_documento',
                'persona__pais',
                'persona__departamento',
                'persona__ciudad',
            ) # Devolvemos solo los pacientes que no están marcados como eliminados y optimizamos la consulta con select_related

    def get_serializer_class(self): # Sobrescribimos el método get_serializer_class para personalizar el serializer
        if self.action in ['list', 'retrieve']: # Si la acción es listar o recuperar un paciente
            return PacienteListSerializer # Usamos el serializer de lista
        return PacienteSerializer # De lo contrario, usamos el serializer estándar

    def perform_create(self, serializer): # Sobrescribimos el método perform_create para personalizar la creación de un paciente
        serializer.save(id_usu_creator=self.request.user) # Guardamos el paciente con el usuario que lo creó

    def perform_update(self, serializer): # Sobrescribimos el método perform_update para personalizar la actualización de un paciente
        serializer.save(id_usu_modificator=self.request.user) # Guardamos el paciente con el usuario que lo actualizó
    
    def perform_destroy(self, instance): # Sobrescribimos el método perform_destroy para personalizar la eliminación de un paciente
        instance.is_deleted = True # Marcamos el paciente como eliminado en lugar de eliminarlo físicamente
        instance.fecha_eliminacion = timezone.now() # Guardamos la fecha de eliminación
        instance.id_usu_modificator = self.request.user # Guardamos el usuario que eliminó el paciente
        instance.save() # Guardamos los cambios en la base de datos

    @action(detail=False, methods=['get'], url_path='eliminados') # Creamos una acción personalizada para listar los pacientes eliminados
    def eliminados(self, request): # Definimos el método para la acción personalizada
        queryset = Paciente.objects.filter(is_deleted=True).select_related('persona') # Obtenemos los pacientes que están marcados como eliminados y optimizamos la consulta con select_related
        serializer = PacienteListSerializer(queryset, many=True) # Serializamos los pacientes eliminados
        return Response(serializer.data) # Devolvemos la respuesta con los datos serializados