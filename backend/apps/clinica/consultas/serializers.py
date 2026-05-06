from rest_framework import serializers
from .models import Consulta


class ConsultaPacienteSerializer(serializers.Serializer):
    id               = serializers.IntegerField()
    nombre           = serializers.SerializerMethodField()
    nro_documento    = serializers.SerializerMethodField()
    fecha_nacimiento = serializers.SerializerMethodField()
    grupo_sanguineo      = serializers.CharField(allow_null=True, default=None)
    alergias_conocidas   = serializers.CharField(allow_null=True, default=None)
    enfermedades_cronicas = serializers.CharField(allow_null=True, default=None)
    responsable_nombre   = serializers.SerializerMethodField()
    responsable_telefono = serializers.SerializerMethodField()

    def get_fecha_nacimiento(self, obj):
        try:
            return obj.persona.fecha_nacimiento
        except Exception:
            return None

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

    def get_responsable_nombre(self, obj):
        try:
            return obj.responsable.persona.razon_social if obj.responsable else None
        except Exception:
            return None

    def get_responsable_telefono(self, obj):
        try:
            return obj.responsable.persona.telefono if obj.responsable else None
        except Exception:
            return None


class ConsultaMedicoSerializer(serializers.Serializer):
    persona_rrhh_id = serializers.IntegerField(source='id')
    nombre          = serializers.SerializerMethodField()
    iniciales       = serializers.SerializerMethodField()

    def get_nombre(self, obj):
        try:
            return obj.persona.razon_social
        except Exception:
            return '—'

    def get_iniciales(self, obj):
        nombre = self.get_nombre(obj)
        partes = [p for p in nombre.upper().split() if p]
        return ''.join(p[0] for p in partes[:2])


class ConsultaAgendaSerializer(serializers.Serializer):
    id         = serializers.IntegerField()
    fecha      = serializers.DateField()
    hora_desde = serializers.TimeField()
    hora_hasta = serializers.TimeField()
    estado     = serializers.CharField()
    paciente_detalle = ConsultaPacienteSerializer(source='paciente', read_only=True)
    medico_detalle   = ConsultaMedicoSerializer(
        source='horario_prestador.persona_rrhh', read_only=True
    )
    especialidades = serializers.SerializerMethodField()

    def get_especialidades(self, obj):
        try:
            return [e.descripcion for e in obj.horario_prestador.especialidades.all()]
        except Exception:
            return []


class ConsultaListSerializer(serializers.ModelSerializer):
    agenda_detalle         = ConsultaAgendaSerializer(source='agenda', read_only=True)
    evento_clinico_nombre  = serializers.CharField(
        source='evento_clinico.tipo_evento', read_only=True, default=None
    )

    class Meta:
        model  = Consulta
        fields = [
            'id', 'agenda', 'agenda_detalle',
            'hora_desde', 'hora_hasta', 'estado',
            'evento_clinico', 'evento_clinico_nombre',
            'motivo_consulta', 'diagnostico', 'tratamiento',
            'indicaciones', 'proxima_cita',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']


class ConsultaSerializer(serializers.ModelSerializer):

    def validate(self, data):
        agenda = data.get('agenda')
        if agenda and self.instance is None:
            if agenda.estado != 'ocupado':
                raise serializers.ValidationError(
                    {'agenda': 'Solo se puede crear una consulta para un turno ocupado. Estado actual: ' + str(agenda.estado) + '.'}
                )
            if Consulta.objects.filter(agenda=agenda, is_deleted=False).exists():
                raise serializers.ValidationError(
                    {'agenda': 'Ya existe una consulta activa para este turno.'}
                )
        return data

    class Meta:
        model  = Consulta
        fields = [
            'id', 'agenda', 'hora_desde', 'hora_hasta', 'estado',
            'evento_clinico', 'motivo_consulta', 'diagnostico',
            'tratamiento', 'indicaciones', 'proxima_cita',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']
