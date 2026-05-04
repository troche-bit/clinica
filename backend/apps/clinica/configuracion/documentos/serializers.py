from rest_framework import serializers
from .models import DocumentoDigPaciente


class DocumentoDigPacienteListSerializer(serializers.ModelSerializer):
    tipo_doc_dig_descripcion = serializers.CharField(
        source='tipo_doc_dig.descripcion', read_only=True
    )
    paciente_nombre = serializers.SerializerMethodField()

    def get_paciente_nombre(self, obj):
        try:
            return obj.paciente.persona.razon_social
        except Exception:
            return '—'

    class Meta:
        model  = DocumentoDigPaciente
        fields = [
            'id', 'paciente', 'paciente_nombre',
            'tipo_doc_dig', 'tipo_doc_dig_descripcion',
            'consulta', 'storage', 'filename',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['storage', 'filename', 'fecha_creacion', 'fecha_modificacion']


class DocumentoDigPacienteSerializer(serializers.ModelSerializer):
    archivo = serializers.FileField(write_only=True)

    class Meta:
        model  = DocumentoDigPaciente
        fields = [
            'id', 'paciente', 'tipo_doc_dig', 'consulta', 'archivo',
        ]

    def create(self, validated_data):
        # 'archivo' no es un campo del modelo — se elimina antes de crear la instancia.
        validated_data.pop('archivo', None)
        return super().create(validated_data)
