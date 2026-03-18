from rest_framework import serializers # Importamos el módulo de serializers de Django REST Framework
from .models import TipoDocumento, Persona # Importamos los modelos TipoDocumento y Persona desde el archivo models.py
from apps.ubicacion.serializers import (
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
    
    def validate_nro_documento(self, value): # Método de validación para el campo nro_documento
        instance = self.instance # Obtenemos la instancia actual del serializer
        qs = Persona.objects.filter(nro_documento=value) # Filtramos las personas por el número de documento proporcionado
        if instance: # Si la instancia existe (es decir, estamos actualizando un registro)
            qs = qs.exclude(pk=instance.pk) # Excluimos la instancia actual de la consulta para evitar falsos positivos
        if qs.exists(): # Si existe alguna persona con el mismo número de documento
            raise serializers.ValidationError("El número de documento ya existe.") # Lanzamos un error de validación
            
        tipo_documento = self.initial_data.get('tipo_documento') # Obtenemos el tipo de documento del data inicial
        if tipo_documento == 1 and len(value) != 8: # Si el tipo de documento es DNI, el número debe tener 8 dígitos
            raise serializers.ValidationError("El número de documento debe tener 8 dígitos para DNI.")
        elif tipo_documento == 2 and len(value) != 11: # Si el tipo de documento es RUC, el número debe tener 11 dígitos
            raise serializers.ValidationError("El número de documento debe tener 11 dígitos para RUC.")
        return value # Retornamos el valor validado