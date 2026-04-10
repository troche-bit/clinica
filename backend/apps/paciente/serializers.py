from rest_framework import serializers # Importamos el módulo de serializers del framework
from .models import Paciente, PacienteResponsable # Importamos el modelo Paciente
from apps.persona.serializers import PersonaSerializer # Importamos el serializer de Persona 

class PacienteResponsableSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Paciente
    persona_detalle = PersonaSerializer(source='persona', read_only=True) # Agregamos un campo para mostrar los detalles de la persona relacionada

    class Meta: # Definimos la clase Meta para configurar el serializer
        model = PacienteResponsable # Especificamos el modelo que se va a serializar
        fields = [
            'id', # Campo de ID del paciente
            'persona', # Campo de relación con Persona
            'persona_detalle', # Campo para mostrar los detalles de la persona relacionada
            'grupo_sanguineo',
            'ocupacion',
            'es_contacto_emergencia',
            'observacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion'] # Especificamos los campos que son de solo lectura
    
class PacienteResponsableListSerializer(serializers.ModelSerializer): # Creamos un serializer para listar los pacientes
    nombre = serializers.CharField(source='persona.razon_social', read_only=True) # Agregamos un campo para mostrar el nombre de la persona relacionada
    documento = serializers.CharField(source='persona.nro_documento', read_only=True) # Agregamos un campo para mostrar el documento de la persona relacionada
    telefono = serializers.CharField(source='persona.telefono', read_only=True)
    persona_detalle = PersonaSerializer(source='persona', read_only=True) # Agregamos un campo para mostrar los detalles de la persona relacionada

    class Meta: # Definimos la clase Meta para configurar el serializer
        model = PacienteResponsable # Especificamos el modelo que se va a serializar
        fields = [
            'id', # Campo de ID del paciente
            'nombre', # Campo para mostrar el nombre de la persona relacionada
            'documento', # Campo para mostrar el documento de la persona relacionada
            'telefono',
            'grupo_sanguineo',
            'ocupacion',
            'es_contacto_emergencia',
            'observacion',
            'persona_detalle',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion'] # Especificamos los campos que son de solo lectura



class PacienteSerializer(serializers.ModelSerializer): # Creamos un serializer para el modelo Paciente
    persona_detalle = PersonaSerializer(read_only=True) # Agregamos un campo para mostrar los detalles de la persona relacionada

    class Meta: # Definimos la clase Meta para configurar el serializer
        model = Paciente # Especificamos el modelo que se va a serializar
        fields = [
            'id', # Campo de ID del paciente
            'persona', # Campo de relación con Persona
            'persona_detalle', # Campo para mostrar los detalles de la persona relacionada
            'fecha_nacimiento', # Campo de fecha de nacimiento del paciente
            'sexo', # Campo de sexo del paciente
            'observacion', # Campo de observaciones del paciente
            'alergias_conocidas', # Campo de alergias conocidas
            'enfermedades_cronicas', # Campo de enfermedades cronicas
            'grupo_sanguineo', # Campo de grupo sanguineo
            'responsable',
            'parentesco',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion'] # Especificamos los campos que son de solo lectura
    
class PacienteListSerializer(serializers.ModelSerializer): # Creamos un serializer para listar los pacientes
    nombre = serializers.CharField(source='persona.razon_social', read_only=True) # Agregamos un campo para mostrar el nombre de la persona relacionada
    documento = serializers.CharField(source='persona.nro_documento', read_only=True) # Agregamos un campo para mostrar el documento de la persona relacionada
    persona_detalle = PersonaSerializer(source='persona', read_only=True) # Agregamos un campo para mostrar los detalles de la persona relacionada
    responsable_detalle = PacienteResponsableListSerializer(source='responsable', read_only=True) 

    class Meta: # Definimos la clase Meta para configurar el serializer
        model = Paciente # Especificamos el modelo que se va a serializar
        fields = [
            'id', # Campo de ID del paciente
            'nombre', # Campo para mostrar el nombre de la persona relacionada
            'documento', # Campo para mostrar el documento de la persona relacionada
            'fecha_nacimiento', # Campo de fecha de nacimiento del paciente
            'sexo', # Campo de sexo del paciente
            'observacion', # Campo de observaciones del paciente
            'alergias_conocidas', # Campo de alergias conocidas
            'enfermedades_cronicas', # Campo de enfermedades cronicas
            'grupo_sanguineo', # Campo de grupo sanguineo
            'responsable',
            'parentesco',
            'responsable_detalle',
            'persona_detalle', 
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion'] # Especificamos los campos que son de solo lectura
