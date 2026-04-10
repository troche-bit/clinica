from rest_framework import serializers # Importamos el módulo serializers de Django REST Framework
from .models import Especialidad

class EspecialidadSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Consultorio
    class Meta:
        model = Especialidad # Especificamos que el modelo a serializar es Consultorio
        fields = ['id', 'descripcion'] # Incluimos todos los campos del modelo
