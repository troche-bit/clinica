from rest_framework import viewsets, filters # Importamos los módulos necesarios de Django REST Framework
from rest_framework.permissions import IsAuthenticated # Importamos el permiso de autenticación
from .models import Consultorio # Importamos los modelos de nuestra aplicación
from .serializers import ConsultorioSerializer # Importamos los serializadores

class ConsultorioViewSet(viewsets.ModelViewSet): # Creamos una vista para el modelo Consultorio
    queryset = Consultorio.objects.all() # Definimos el conjunto de datos que se va a utilizar
    serializer_class = ConsultorioSerializer # Especificamos el serializador que se va a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado para acceder a esta vista
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos filtros de búsqueda y ordenamiento
    search_fields = ['nro_consultorio'] # Especificamos los campos por los cuales se puede buscar
    ordering_fields = ['nro_consultorio'] # Especificamos los campos por los cuales se puede ordenar
