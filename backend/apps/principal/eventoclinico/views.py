from rest_framework import viewsets, filters # Importamos los módulos necesarios de Django REST Framework
from rest_framework.permissions import IsAuthenticated # Importamos el permiso de autenticación
from .models import EventoClinico # Importamos los modelos de nuestra aplicación
from .serializers import EventoClinicoSerializer # Importamos los serializadores

class EventoClinicoViewSet(viewsets.ModelViewSet): # Creamos una vista para el modelo Consultorio
    queryset = EventoClinico.objects.all() # Definimos el conjunto de datos que se va a utilizar
    serializer_class = EventoClinicoSerializer # Especificamos el serializador que se va a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado para acceder a esta vista
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos filtros de búsqueda y ordenamiento
    search_fields = ['tipo_evento'] # Especificamos los campos por los cuales se puede buscar
    ordering_fields = ['tipo_evento'] # Especificamos los campos por los cuales se puede ordenar
