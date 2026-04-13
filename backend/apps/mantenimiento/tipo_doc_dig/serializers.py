from rest_framework import serializers
from django.db.models.functions import Lower
from .models import TipoDocDigital


class TipoDocDigitalSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoDocDigital
        fields = ["id", "descripcion", "storage_key"]

    # Validación pre-INSERT: evita descripción duplicada sin incrementar el PK
    def validate_descripcion(self, value):
        qs = TipoDocDigital.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        existe = (
            qs
            .annotate(desc_lower=Lower("descripcion"))
            .filter(desc_lower=value.strip().lower())
            .exists()
        )
        if existe:
            raise serializers.ValidationError("Ya existe un tipo de documento con esa descripción.")
        return value

    # Validación pre-INSERT: evita storage_key duplicado
    def validate_storage_key(self, value):
        valor = value.strip().lower()
        qs = TipoDocDigital.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.filter(storage_key=valor).exists():
            raise serializers.ValidationError("Ya existe un tipo de documento con esa clave de almacenamiento.")
        return valor

    def update(self, instance, validated_data):
        # storage_key no se modifica después de la creación:
        # cambiarla rompería las rutas de archivos ya almacenados en disco/nube.
        validated_data.pop("storage_key", None)
        return super().update(instance, validated_data)
