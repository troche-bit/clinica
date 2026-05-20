from rest_framework import serializers
from .models import Notificacion, ConfiguracionNotificacion, PlantillaNotificacion


class NotificacionListSerializer(serializers.ModelSerializer):
    tipo_display   = serializers.CharField(source='get_tipo_display',   read_only=True)
    canal_display  = serializers.CharField(source='get_canal_display',  read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)

    class Meta:
        model  = Notificacion
        fields = [
            'id', 'tipo', 'tipo_display',
            'canal', 'canal_display',
            'estado', 'estado_display',
            'mensaje', 'destinatario',
            'fecha_envio', 'fecha_creacion',
        ]


class ConfiguracionNotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ConfiguracionNotificacion
        fields = [
            'email_remitente', 'nombre_remitente', 'habilitado',
            'auto_recordatorio', 'horas_anticipacion', 'horas_anticipacion_2',
            'auto_confirmacion', 'auto_cancelacion',
        ]


class PlantillaNotificacionListSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)

    class Meta:
        model  = PlantillaNotificacion
        fields = [
            'id', 'tipo', 'tipo_display',
            'asunto', 'cuerpo', 'activa',
            'fecha_creacion', 'fecha_modificacion',
        ]


class PlantillaNotificacionSerializer(serializers.ModelSerializer):
    class Meta:
        model      = PlantillaNotificacion
        fields     = ['id', 'tipo', 'asunto', 'cuerpo', 'activa']
        validators = []

    def validate_tipo(self, value):
        qs = PlantillaNotificacion.objects.filter(tipo=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Ya existe una plantilla activa para este tipo de notificación.'
            )
        return value
