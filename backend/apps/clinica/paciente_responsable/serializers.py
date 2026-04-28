from rest_framework import serializers
from .models import PacienteResponsable
from apps.administracion.persona.serializers import PersonaListSerializer


class PacienteResponsableListSerializer(serializers.ModelSerializer):
    nombre          = serializers.CharField(source="persona.razon_social", read_only=True)
    documento       = serializers.CharField(source="persona.nro_documento", read_only=True)
    telefono        = serializers.CharField(source="persona.telefono",      read_only=True)
    persona_detalle = PersonaListSerializer(source="persona", read_only=True)

    class Meta:
        model  = PacienteResponsable
        fields = [
            "id",
            "nombre",
            "documento",
            "telefono",
            "grupo_sanguineo",
            "ocupacion",
            "es_contacto_emergencia",
            "observacion",
            "persona_detalle",
        ]


class PacienteResponsableSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PacienteResponsable
        fields = [
            "id",
            "persona",
            "grupo_sanguineo",
            "ocupacion",
            "es_contacto_emergencia",
            "observacion",
        ]
