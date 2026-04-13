from rest_framework import serializers
from django.db.models.functions import Lower
from .models import Consultorio


class ConsultorioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultorio
        fields = ['id', 'nro_consultorio', 'descripcion']

    def validate_nro_consultorio(self, value):
        """
        Valida que el nro_consultorio no exista en registros activos (case-insensitive).
        Al validar ANTES del INSERT, evita que la secuencia de IDs avance en registros fallidos.
        """
        qs = Consultorio.objects.filter(is_deleted=False)
        # En edicion excluir el registro actual
        instance = self.instance
        if instance:
            qs = qs.exclude(pk=instance.pk)
        # Comparacion sin distincion de mayusculas/minusculas
        if qs.annotate(nro_lower=Lower('nro_consultorio')).filter(nro_lower=value.strip().lower()).exists():
            raise serializers.ValidationError(
                'Ya existe un consultorio con ese número (verificar mayúsculas y minúsculas).'
            )
        return value
