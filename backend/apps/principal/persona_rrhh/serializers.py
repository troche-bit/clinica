from rest_framework import serializers
from .models import PersonaRRHH
from apps.administracion.persona.serializers import PersonaListSerializer
from apps.clinica.configuracion.especialidad.serializers import EspecialidadListSerializer


class PersonaRRHHSerializer(serializers.ModelSerializer):
    persona_detalle = PersonaListSerializer(source="persona", read_only=True)

    class Meta:
        model  = PersonaRRHH
        fields = [
            "id",
            "persona",
            "persona_detalle",
            "fecha_nacimiento",
            "fecha_ingreso",
            "nro_matricula",
            "especialidades",
            "cargo",
            "tipo_contrato",
            "estado",
            "honorario",
            "observacion",
        ]
        read_only_fields = ["fecha_creacion", "fecha_modificacion"]


class PersonaRRHHListSerializer(serializers.ModelSerializer):
    nombre              = serializers.CharField(source="persona.razon_social",  read_only=True)
    documento           = serializers.CharField(source="persona.nro_documento", read_only=True)
    telefono            = serializers.CharField(source="persona.telefono",      read_only=True)
    persona_detalle     = PersonaListSerializer(source="persona", read_only=True)
    especialidades_detalle = EspecialidadListSerializer(source="especialidades", many=True, read_only=True)

    class Meta:
        model  = PersonaRRHH
        fields = [
            "id",
            "nombre",
            "documento",
            "telefono",
            "fecha_nacimiento",
            "fecha_ingreso",
            "nro_matricula",
            "especialidades",
            "especialidades_detalle",
            "cargo",
            "tipo_contrato",
            "estado",
            "honorario",
            "observacion",
            "persona_detalle",
        ]
        read_only_fields = ["fecha_creacion", "fecha_modificacion"]
