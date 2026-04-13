from rest_framework import serializers
from django.db.models.functions import Lower
from .models import Especialidad


class EspecialidadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Especialidad
        fields = ["id", "descripcion"]

    # Validación pre-INSERT: evita duplicados sin incrementar el PK de la secuencia
    def validate_descripcion(self, value):
        qs = Especialidad.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        existe = (
            qs
            .annotate(desc_lower=Lower("descripcion"))
            .filter(desc_lower=value.strip().lower())
            .exists()
        )
        if existe:
            raise serializers.ValidationError("Ya existe una especialidad con esa descripción.")
        return value
