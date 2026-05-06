from datetime import date
from rest_framework import serializers
from .models import PersonaRRHH
from apps.administracion.persona.serializers import PersonaListSerializer
from apps.clinica.configuracion.especialidad.serializers import EspecialidadListSerializer


class PersonaRRHHListSerializer(serializers.ModelSerializer):
    nombre                 = serializers.CharField(source="persona.razon_social",  read_only=True)
    documento              = serializers.CharField(source="persona.nro_documento", read_only=True)
    telefono               = serializers.CharField(source="persona.telefono",      read_only=True)
    fecha_nacimiento       = serializers.DateField(source="persona.fecha_nacimiento", read_only=True)
    persona_detalle        = PersonaListSerializer(source="persona", read_only=True)
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


class PersonaRRHHSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PersonaRRHH
        fields = [
            "id",
            "persona",
            "fecha_ingreso",
            "nro_matricula",
            "especialidades",
            "cargo",
            "tipo_contrato",
            "estado",
            "honorario",
            "observacion",
        ]

    def validate_nro_matricula(self, value):
        if not value:
            return None
        return value.strip()

    def validate_observacion(self, value):
        return value.strip() if value else value

    def validate_honorario(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('El honorario no puede ser negativo.')
        return value

    def validate_fecha_ingreso(self, value):
        if value and value > date.today():
            raise serializers.ValidationError('La fecha de ingreso no puede ser futura.')
        return value
