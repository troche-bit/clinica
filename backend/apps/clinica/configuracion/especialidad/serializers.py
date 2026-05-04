from rest_framework import serializers
from django.db.models.functions import Lower
from .models import Especialidad


class EspecialidadListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Especialidad
        fields = ['id', 'descripcion']


class EspecialidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Especialidad
        fields = ['id', 'descripcion']

    def validate_descripcion(self, value):
        qs = Especialidad.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.annotate(desc_lower=Lower('descripcion')).filter(desc_lower=value.strip().lower()).exists():
            raise serializers.ValidationError('Ya existe una especialidad con esa descripción.')
        return value.strip()
