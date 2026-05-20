from rest_framework import serializers
from .models import RegistroAuditoria
from .utils import MODULOS


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario_username = serializers.CharField(source='usuario.username', read_only=True)
    accion_display   = serializers.CharField(source='get_accion_display', read_only=True)
    modulo_display   = serializers.SerializerMethodField()

    def get_modulo_display(self, obj):
        return MODULOS.get(obj.tabla, obj.tabla)

    class Meta:
        model  = RegistroAuditoria
        fields = [
            'id', 'fecha',
            'usuario', 'usuario_username',
            'modulo_display',
            'accion', 'accion_display',
            'tabla', 'registro_id', 'ip',
            'datos_antes', 'datos_despues',
        ]