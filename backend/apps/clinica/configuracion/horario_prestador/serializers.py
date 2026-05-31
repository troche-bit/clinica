from rest_framework import serializers
from .models import HorarioPrestador
from apps.mantenimiento.diasemana.models import DiaSemana
from apps.mantenimiento.diasemana.serializers import DiaSemanaSerializer
from apps.clinica.configuracion.especialidad.serializers import EspecialidadListSerializer
from apps.clinica.configuracion.consultorio.serializers import ConsultorioListSerializer
from apps.administracion.persona_rrhh.serializers import PersonaRRHHListSerializer


class HorarioPrestadorSerializer(serializers.ModelSerializer):

    # required=False: DRF rechazaría el campo antes de validate(). La validación
    # condicional (requerido solo si excepcion=False) ocurre ahí.
    dia_semana = serializers.PrimaryKeyRelatedField(
        queryset=DiaSemana.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model  = HorarioPrestador
        fields = [
            'id', 'persona_rrhh', 'consultorio', 'dia_semana', 'hora_desde', 'hora_hasta',
            'intervalo', 'especialidades', 'estado', 'excepcion', 'fecha_excepcion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']
        validators = []

    def validate(self, data):
        inst            = self.instance
        hora_desde      = data.get('hora_desde',      inst.hora_desde      if inst else None)
        hora_hasta      = data.get('hora_hasta',      inst.hora_hasta      if inst else None)
        excepcion       = data.get('excepcion',       inst.excepcion       if inst else False)
        fecha_excepcion = data.get('fecha_excepcion', inst.fecha_excepcion if inst else None)
        dia_semana      = data.get('dia_semana',      inst.dia_semana      if inst else None)
        persona_rrhh    = data.get('persona_rrhh',    inst.persona_rrhh    if inst else None)

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

        # Unicidad: mismo prestador, día y hora de inicio (solo horarios no excepción)
        if not excepcion:
            qs = HorarioPrestador.objects.filter(
                persona_rrhh=persona_rrhh,
                dia_semana=dia_semana,
                hora_desde=hora_desde,
                is_deleted=False,
                excepcion=False,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    'Ya existe un horario para este prestador con el mismo día y hora de inicio.'
                )

        return data


class HorarioPrestadorListSerializer(serializers.ModelSerializer):
    dia_semana_detalle     = DiaSemanaSerializer(source='dia_semana',     read_only=True)
    especialidades_detalle = EspecialidadListSerializer(source='especialidades', many=True, read_only=True)
    persona_rrhh_detalle   = PersonaRRHHListSerializer(source='persona_rrhh', read_only=True)
    consultorio_detalle    = ConsultorioListSerializer(source='consultorio', read_only=True)

    class Meta:
        model  = HorarioPrestador
        fields = [
            'id', 'persona_rrhh', 'persona_rrhh_detalle',
            'consultorio', 'consultorio_detalle',
            'dia_semana', 'dia_semana_detalle',
            'hora_desde', 'hora_hasta', 'intervalo',
            'especialidades', 'especialidades_detalle',
            'estado', 'excepcion', 'fecha_excepcion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']
