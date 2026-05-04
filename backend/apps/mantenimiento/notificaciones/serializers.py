from rest_framework import serializers
from .models import Notificacion


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
