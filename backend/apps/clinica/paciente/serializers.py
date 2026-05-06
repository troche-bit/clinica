from rest_framework import serializers
from .models import Paciente
from apps.administracion.persona.serializers import PersonaListSerializer
from apps.clinica.paciente_responsable.serializers import PacienteResponsableListSerializer


class PacienteSerializer(serializers.ModelSerializer):
    persona_detalle = PersonaListSerializer(read_only=True)

    class Meta:
        model  = Paciente
        fields = [
            "id",
            "persona",
            "persona_detalle",
            "sexo",
            "observacion",
            "alergias_conocidas",
            "enfermedades_cronicas",
            "grupo_sanguineo",
            "responsable",
            "parentesco",
        ]
        read_only_fields = ["fecha_creacion", "fecha_modificacion"]

    def validate_observacion(self, value):
        return value.strip() if value else value

    def validate_parentesco(self, value):
        return value.strip() if value else value

    def validate_alergias_conocidas(self, value):
        return value.strip() if value else value

    def validate_enfermedades_cronicas(self, value):
        return value.strip() if value else value


class PacienteListSerializer(serializers.ModelSerializer):
    nombre              = serializers.CharField(source="persona.razon_social",  read_only=True)
    documento           = serializers.CharField(source="persona.nro_documento", read_only=True)
    fecha_nacimiento    = serializers.DateField(source="persona.fecha_nacimiento", read_only=True)
    persona_detalle     = PersonaListSerializer(source="persona", read_only=True)
    responsable_detalle = PacienteResponsableListSerializer(source="responsable", read_only=True)

    class Meta:
        model  = Paciente
        fields = [
            "id",
            "nombre",
            "documento",
            "fecha_nacimiento",
            "sexo",
            "observacion",
            "alergias_conocidas",
            "enfermedades_cronicas",
            "grupo_sanguineo",
            "responsable",
            "parentesco",
            "responsable_detalle",
            "persona_detalle",
        ]
        read_only_fields = ["fecha_creacion", "fecha_modificacion"]
