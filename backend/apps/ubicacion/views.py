from rest_framework import viewsets, filters # Importamos los módulos necesarios de Django REST Framework
from rest_framework.permissions import IsAuthenticated # Importamos el permiso de autenticación
from .models import Pais, Departamento, Ciudad # Importamos los modelos de nuestra aplicación
from .serializers import PaisSerializer, DepartamentoSerializer, CiudadSerializer # Importamos los serializadores

class PaisViewSet(viewsets.ModelViewSet): # Creamos una vista para el modelo Pais
    queryset = Pais.objects.all() # Definimos el conjunto de datos que se va a utilizar
    serializer_class = PaisSerializer # Especificamos el serializador que se va a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado para acceder a esta vista
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos filtros de búsqueda y ordenamiento
    search_fields = ['descripcion'] # Especificamos los campos por los cuales se puede buscar
    ordering_fields = ['descripcion'] # Especificamos los campos por los cuales se puede ordenar

class DepartamentoViewSet(viewsets.ModelViewSet): # Creamos una vista para el modelo Departamento
    serializer_class = DepartamentoSerializer # Especificamos el serializador que se va a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado para acceder a esta vista
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos filtros de búsqueda y ordenamiento
    search_fields = ['descripcion'] # Especificamos los campos por los cuales se puede buscar
    ordering_fields = ['descripcion'] # Especificamos los campos por los cuales se puede ordenar
    
    def get_queryset(self): # Sobrescribimos el método get_queryset para personalizar la consulta de datos
        queryset = Departamento.objects.select_related('pais').all() # Obtenemos el conjunto de datos con una consulta optimizada
        pais_id = self.request.query_params.get('pais') # Obtenemos el parámetro de país de la solicitud
        if pais_id is not None: # Si se proporcionó un ID de país
            queryset = queryset.filter(pais_id=pais_id) # Filtramos el conjunto de datos por el ID de país
        return queryset # Devolvemos el conjunto de datos filtrado

class CiudadViewSet(viewsets.ModelViewSet): # Creamos una vista para el modelo Ciudad
    serializer_class = CiudadSerializer # Especificamos el serializador que se va a usar
    permission_classes = [IsAuthenticated] # Requerimos que el usuario esté autenticado para acceder a esta vista
    filter_backends = [filters.SearchFilter, filters.OrderingFilter] # Agregamos filtros de búsqueda y ordenamiento
    search_fields = ['descripcion'] # Especificamos los campos por los cuales se puede buscar
    ordering_fields = ['descripcion'] # Especificamos los campos por los cuales se puede ordenar
    
    def get_queryset(self): # Sobrescribimos el método get_queryset para personalizar la consulta de datos
        queryset = Ciudad.objects.select_related('departamento__pais').all() # Obtenemos el conjunto de datos con una consulta optimizada
        departamento_id = self.request.query_params.get('departamento') # Obtenemos el parámetro de departamento de la solicitud
        if departamento_id is not None: # Si se proporcionó un ID de departamento
            queryset = queryset.filter(departamento_id=departamento_id) # Filtramos el conjunto de datos por el ID de departamento
        return queryset # Devolvemos el conjunto de datos filtrado