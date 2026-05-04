from rest_framework import serializers
from .models import HorarioPrestador
from apps.mantenimiento.diasemana.models import DiaSemana
from apps.mantenimiento.diasemana.serializers import DiaSemanaSerializer
from apps.clinica.configuracion.especialidad.serializers import EspecialidadListSerializer
from apps.administracion.persona_rrhh.serializers import PersonaRRHHListSerializer


class HorarioPrestadorSerializer(serializers.ModelSerializer):
    """Serializer de escritura — recibe IDs."""

    # required=False para que DRF no rechace el campo antes del validate().
    # La validación condicional (requerido solo si excepcion=False) se hace en validate().
    dia_semana = serializers.PrimaryKeyRelatedField(
        queryset=DiaSemana.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model  = HorarioPrestador
        fields = [
            'id', 'persona_rrhh', 'dia_semana', 'hora_desde', 'hora_hasta',
            'intervalo', 'especialidades', 'estado', 'excepcion', 'fecha_excepcion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']

    def validate(self, data):
        hora_desde      = data.get('hora_desde')
        hora_hasta      = data.get('hora_hasta')
        excepcion       = data.get('excepcion', False)
        fecha_excepcion = data.get('fecha_excepcion')
        dia_semana      = data.get('dia_semana')

        # hora_hasta debe ser posterior a hora_desde
        if hora_desde and hora_hasta and hora_hasta <= hora_desde:
            raise serializers.ValidationError(
                {'hora_hasta': 'Debe ser posterior a la hora de inicio.'}
            )

        # dia_semana requerido cuando NO es excepción
        if not excepcion and not dia_semana:
            raise serializers.ValidationError(
                {'dia_semana': 'Requerido cuando el horario no es una excepción.'}
            )

        # fecha_excepcion obligatoria si excepcion=True
        if excepcion and not fecha_excepcion:
            raise serializers.ValidationError(
                {'fecha_excepcion': 'Requerido cuando el horario es una excepción.'}
            )

        # Auto-asignar dia_semana según el día de la semana de fecha_excepcion
        # weekday(): 0=Lun…6=Dom | DiaSemana.id: 1=Lun…7=Dom
        if excepcion and fecha_excepcion:
            dia_id = fecha_excepcion.weekday() + 1
            try:
                data['dia_semana'] = DiaSemana.objects.get(id=dia_id)
            except DiaSemana.DoesNotExist:
                raise serializers.ValidationError(
                    {'fecha_excepcion': 'No se pudo determinar el día de la semana.'}
                )

        return data


class HorarioPrestadorListSerializer(serializers.ModelSerializer):
    """Serializer de lectura — expande relaciones."""
    dia_semana_detalle     = DiaSemanaSerializer(source='dia_semana',     read_only=True)
    especialidades_detalle = EspecialidadListSerializer(source='especialidades', many=True, read_only=True)
    persona_rrhh_detalle   = PersonaRRHHListSerializer(source='persona_rrhh', read_only=True)

    class Meta:
        model  = HorarioPrestador
        fields = [
            'id', 'persona_rrhh', 'persona_rrhh_detalle',
            'dia_semana', 'dia_semana_detalle',
            'hora_desde', 'hora_hasta', 'intervalo',
            'especialidades', 'especialidades_detalle',
            'estado', 'excepcion', 'fecha_excepcion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']
