from rest_framework import serializers
from .models import RegistroAuditoria


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)
    accion_display   = serializers.CharField(source='get_accion_display', read_only=True)

    class Meta:
        model  = RegistroAuditoria
        fields = [
            'id', 'tabla', 'registro_id', 'accion', 'accion_display',
            'datos_antes', 'datos_despues',
            'usuario', 'usuario_username',
            'fecha', 'ip',
        ]