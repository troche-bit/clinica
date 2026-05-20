from rest_framework import serializers
from .models import Agenda


class AgendaMedicoDetalleSerializer(serializers.Serializer):
    persona_rrhh_id = serializers.IntegerField(source='persona_rrhh.id')
    nombre          = serializers.SerializerMethodField()
    iniciales       = serializers.SerializerMethodField()
    especialidades  = serializers.SerializerMethodField()

    def get_nombre(self, obj):
        try:
            return obj.persona_rrhh.persona.razon_social
        except Exception:
            return '—'

    def get_iniciales(self, obj):
        nombre = self.get_nombre(obj)
        partes = [p for p in nombre.upper().split() if p]
        return ''.join(p[0] for p in partes[:2])

    def get_especialidades(self, obj):
        return [e.descripcion for e in obj.especialidades.all()]


class AgendaPacienteDetalleSerializer(serializers.Serializer):
    id            = serializers.IntegerField()
    nombre        = serializers.SerializerMethodField()
    nro_documento = serializers.SerializerMethodField()

    def get_nombre(self, obj):
        try:
            return obj.persona.razon_social
        except Exception:
            return '—'

    def get_nro_documento(self, obj):
        try:
            return obj.persona.nro_documento
        except Exception:
            return ''


class AgendaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Agenda
        fields = [
            'id', 'horario_prestador', 'paciente',
            'fecha', 'hora_desde', 'hora_hasta',
            'estado', 'observacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']
        validators = []

    def validate(self, data):
        qs = Agenda.objects.filter(
            horario_prestador=data.get('horario_prestador'),
            fecha=data.get('fecha'),
            hora_desde=data.get('hora_desde'),
            is_deleted=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Ya existe un turno para este horario en la misma fecha y hora de inicio.'
            )
        return data


class AgendaListSerializer(serializers.ModelSerializer):
    horario_prestador_detalle = AgendaMedicoDetalleSerializer(
        source='horario_prestador', read_only=True,
    )
    paciente_detalle = AgendaPacienteDetalleSerializer(
        source='paciente', read_only=True,
    )
    consulta_estado = serializers.SerializerMethodField()

    def get_consulta_estado(self, obj):
        consulta = next(
            (c for c in obj.consultas.all() if not c.is_deleted),
            None,
        )
        return consulta.estado if consulta else None

    class Meta:
        model  = Agenda
        fields = [
            'id', 'horario_prestador', 'horario_prestador_detalle',
            'paciente', 'paciente_detalle',
            'fecha', 'hora_desde', 'hora_hasta',
            'estado', 'observacion',
            'pagado_prestador', 'pago_prestador',
            'consulta_estado',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']
