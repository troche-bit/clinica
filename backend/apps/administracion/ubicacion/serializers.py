from rest_framework import serializers
from django.db.models.functions import Lower
from .models import Pais, Departamento, Ciudad


class PaisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pais
        fields = ["id", "descripcion"]

    def validate_descripcion(self, value):
        """
        Valida unicidad case-insensitive para países activos antes del INSERT,
        evitando que la secuencia de IDs avance en registros fallidos.
        """
        qs = Pais.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.annotate(desc_lower=Lower("descripcion")).filter(desc_lower=value.strip().lower()).exists():
            raise serializers.ValidationError("Ya existe un país con esa descripción.")
        return value


class DepartamentoSerializer(serializers.ModelSerializer):
    pais_descripcion = serializers.CharField(source="pais.descripcion", read_only=True)

    class Meta:
        model = Departamento
        fields = ["id", "descripcion", "pais", "pais_descripcion"]

    def validate(self, data):
        """
        Valida unicidad de descripcion dentro del mismo país, case-insensitive,
        antes del INSERT para evitar incremento de PK en registros fallidos.
        """
        descripcion = data.get("descripcion", getattr(self.instance, "descripcion", None))
        pais = data.get("pais", getattr(self.instance, "pais", None))
        if descripcion and pais:
            qs = Departamento.objects.filter(is_deleted=False, pais=pais)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.annotate(desc_lower=Lower("descripcion")).filter(desc_lower=descripcion.strip().lower()).exists():
                raise serializers.ValidationError(
                    {"descripcion": "Ya existe un departamento con esa descripción en el país seleccionado."}
                )
        return data


class CiudadSerializer(serializers.ModelSerializer):
    departamento_descripcion = serializers.CharField(source="departamento.descripcion", read_only=True)

    class Meta:
        model = Ciudad
        fields = ["id", "descripcion", "departamento", "departamento_descripcion"]

    def validate(self, data):
        """
        Valida unicidad de descripcion dentro del mismo departamento, case-insensitive,
        antes del INSERT para evitar incremento de PK en registros fallidos.
        """
        descripcion = data.get("descripcion", getattr(self.instance, "descripcion", None))
        departamento = data.get("departamento", getattr(self.instance, "departamento", None))
        if descripcion and departamento:
            qs = Ciudad.objects.filter(is_deleted=False, departamento=departamento)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.annotate(desc_lower=Lower("descripcion")).filter(desc_lower=descripcion.strip().lower()).exists():
                raise serializers.ValidationError(
                    {"descripcion": "Ya existe una ciudad con esa descripción en el departamento seleccionado."}
                )
        return data
