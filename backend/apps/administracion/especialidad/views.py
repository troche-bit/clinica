from rest_framework import viewsets, filters # Importamos los módulos necesarios de Django REST Framework
from rest_framework.permissions import IsAuthenticated # Importamos el permiso de autenticación
from .models import Especialidad # Importamos los modelos de nuestra aplicación
from .serializers import EspecialidadSerializer # Importamos los serializadores

class EspecialidadViewSet(viewsets.ModelViewSet): # Creamos una vista para el modelo Consultorio
    queryset = Especialidad.objects.all() # Definimos el conjunto de datos que se va a utilizar
    serializer_class = EspecialidadSerializer # Especificamos el serializador que se va a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado para acceder a esta vista
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos filtros de búsqueda y ordenamiento
    search_fields = ['descripcion'] # Especificamos los campos por los cuales se puede buscar
    ordering_fields = ['especialidad'] # Especificamos los campos por los cuales se puede ordenar
