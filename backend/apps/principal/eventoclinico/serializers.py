from rest_framework import serializers
from django.db.models.functions import Lower
from .models import EventoClinico


class EventoClinicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventoClinico
        fields = ["id", "tipo_evento"]

    # Validación pre-INSERT: evita duplicados sin incrementar el PK de la secuencia
    def validate_tipo_evento(self, value):
        qs = EventoClinico.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        existe = (
            qs
            .annotate(tipo_lower=Lower("tipo_evento"))
            .filter(tipo_lower=value.strip().lower())
            .exists()
        )
        if existe:
            raise serializers.ValidationError("Ya existe un evento clínico con ese nombre.")
        return value
