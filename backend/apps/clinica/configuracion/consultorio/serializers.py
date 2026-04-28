from rest_framework import serializers
from django.db.models.functions import Lower
from .models import Consultorio


class ConsultorioListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultorio
        fields = ['id', 'nro_consultorio', 'descripcion']


class ConsultorioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Consultorio
        fields = ['id', 'nro_consultorio', 'descripcion']

    def validate_nro_consultorio(self, value):
        qs = Consultorio.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.annotate(nro_lower=Lower('nro_consultorio')).filter(nro_lower=value.strip().lower()).exists():
            raise serializers.ValidationError(
                'Ya existe un consultorio con ese número (verificar mayúsculas y minúsculas).'
            )
        return value
