from rest_framework import serializers # Importamos el módulo serializers de Django REST Framework
from .models import EventoClinico

class EventoClinicoSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Consultorio
    class Meta:
        model = EventoClinico # Especificamos que el modelo a serializar es Consultorio
        fields = ['id', 'tipo_evento'] # Incluimos todos los campos del modelo
