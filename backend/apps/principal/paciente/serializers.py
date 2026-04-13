from rest_framework import serializers
from .models import Paciente
from apps.persona.serializers import PersonaSerializer
from apps.principal.paciente_responsable.serializers import PacienteResponsableListSerializer


class PacienteSerializer(serializers.ModelSerializer):
    persona_detalle = PersonaSerializer(read_only=True)

    class Meta:
        model  = Paciente
        fields = [
            "id",
            "persona",
            "persona_detalle",
            "fecha_nacimiento",
            "sexo",
            "observacion",
            "alergias_conocidas",
            "enfermedades_cronicas",
            "grupo_sanguineo",
            "responsable",
            "parentesco",
        ]
        read_only_fields = ["fecha_creacion", "fecha_modificacion"]


class PacienteListSerializer(serializers.ModelSerializer):
    nombre              = serializers.CharField(source="persona.razon_social",  read_only=True)
    documento           = serializers.CharField(source="persona.nro_documento", read_only=True)
    persona_detalle     = PersonaSerializer(source="persona", read_only=True)
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
