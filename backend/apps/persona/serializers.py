from rest_framework import serializers # Importamos el módulo de serializers de Django REST Framework
from .models import TipoDocumento, Persona # Importamos los modelos TipoDocumento y Persona desde el archivo models.py
from apps.administracion.ubicacion.serializers import (
    PaisSerializer, DepartamentoSerializer, CiudadSerializer
)

class TipoDocumentoSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo TipoDocumento
    class Meta:
        model = TipoDocumento # Especificamos el modelo que se va a serializar
        fields = ['id', 'descripcion'] # Especificamos los campos que se van a incluir en la serialización

class PersonaSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Persona
    tipo_documento_detalle = TipoDocumentoSerializer(source='tipo_documento', read_only=True) # Agregamos un campo adicional para mostrar los detalles del tipo de documento
    pais_detalle = PaisSerializer(source='pais', read_only=True) # Agregamos un campo adicional para mostrar los detalles del país
    departamento_detalle = DepartamentoSerializer(source='departamento', read_only=True) # Agregamos un campo adicional para mostrar los detalles del departamento  
    ciudad_detalle = CiudadSerializer(source='ciudad', read_only=True) # Agregamos un campo adicional para mostrar los detalles de la ciudad

    class Meta:
        model = Persona # Especificamos el modelo que se va a serializar
        fields = [
            'id', 'tipo_documento', 'tipo_documento_detalle', 'nro_documento', 
            'ruc_dv', 'razon_social', 'telefono', 'correo_electronico', 'pais', 'pais_detalle',
            'departamento', 'departamento_detalle', 'ciudad', 'ciudad_detalle', 'direccion'
        ] # Especificamos los campos que se van a incluir en la serialización, incluyendo los campos adicionales para los detalles de las relaciones
    
    def validate_nro_documento(self, value):
        # Bug D corregido: solo verificamos contra registros activos (is_deleted=False)
        # para no bloquear creación si el documento perteneció a una persona borrada
        qs = Persona.objects.filter(nro_documento=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("El número de documento ya existe.")
        return value