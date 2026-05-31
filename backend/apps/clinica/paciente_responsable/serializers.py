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

    def validate_persona(self, value):
        qs = PacienteResponsable.objects.filter(persona=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Esta persona ya tiene un responsable activo registrado.')
        return value

    def validate_grupo_sanguineo(self, value):
        return value.strip() if value else value

    def validate_ocupacion(self, value):
        return value.strip() if value else value

    def validate_observacion(self, value):
        return value.strip() if value else value
