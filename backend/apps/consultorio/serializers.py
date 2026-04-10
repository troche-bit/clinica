from rest_framework import serializers # Importamos el módulo serializers de Django REST Framework
from .models import Consultorio

class ConsultorioSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Consultorio
    class Meta:
        model = Consultorio # Especificamos que el modelo a serializar es Consultorio
        fields = ['id', 'nro_consultorio', 'descripcion'] # Incluimos todos los campos del modelo
