from rest_framework import serializers # Importamos el módulo serializers de Django REST Framework
from .models import Pais, Departamento, Ciudad # Importamos los modelos Pais, Departamento y Ciudad desde el archivo models.py

class PaisSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Pais
    class Meta:
        model = Pais # Especificamos que el modelo a serializar es Pais
        fields = ['id', 'descripcion'] # Incluimos todos los campos del modelo

class DepartamentoSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Departamento
    pais_descripcion = serializers.CharField(source='pais.descripcion', read_only=True) # Agregamos un campo adicional para mostrar la descripción del país asociado
    class Meta:
        model = Departamento # Especificamos que el modelo a serializar es Departamento
        fields = ['id', 'descripcion', 'pais', 'pais_descripcion'] # Incluimos todos los campos del modelo

class CiudadSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Ciudad
    departamento_descripcion = serializers.CharField(source='departamento.descripcion', read_only=True) # Agregamos un campo adicional para mostrar la descripción del departamento asociado
    class Meta:
        model = Ciudad # Especificamos que el modelo a serializar es Ciudad
        fields = ['id', 'descripcion', 'departamento', 'departamento_descripcion'] # Incluimos todos los campos del modelo