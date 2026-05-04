from rest_framework import serializers
from django.db.models.functions import Lower
from .models import Pais, Departamento, Ciudad


class PaisListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pais
        fields = ['id', 'descripcion']


class PaisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pais
        fields = ['id', 'descripcion']

    def validate_descripcion(self, value):
        qs = Pais.objects.filter(is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.annotate(desc_lower=Lower('descripcion')).filter(desc_lower=value.strip().lower()).exists():
            raise serializers.ValidationError('Ya existe un país con esa descripción.')
        return value.strip()


class DepartamentoListSerializer(serializers.ModelSerializer):
    pais_descripcion = serializers.CharField(source='pais.descripcion', read_only=True)

    class Meta:
        model = Departamento
        fields = ['id', 'descripcion', 'pais', 'pais_descripcion']


class DepartamentoSerializer(serializers.ModelSerializer):
    pais_descripcion = serializers.CharField(source='pais.descripcion', read_only=True)

    class Meta:
        model = Departamento
        fields = ['id', 'descripcion', 'pais', 'pais_descripcion']

    def validate(self, data):
        descripcion = data.get('descripcion', getattr(self.instance, 'descripcion', None))
        pais = data.get('pais', getattr(self.instance, 'pais', None))
        if descripcion and pais:
            descripcion = descripcion.strip()
            qs = Departamento.objects.filter(is_deleted=False, pais=pais)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.annotate(desc_lower=Lower('descripcion')).filter(desc_lower=descripcion.lower()).exists():
                raise serializers.ValidationError(
                    {'descripcion': 'Ya existe un departamento con esa descripción en el país seleccionado.'}
                )
            data['descripcion'] = descripcion
        return data


class CiudadListSerializer(serializers.ModelSerializer):
    departamento_descripcion = serializers.CharField(source='departamento.descripcion', read_only=True)

    class Meta:
        model = Ciudad
        fields = ['id', 'descripcion', 'departamento', 'departamento_descripcion']


class CiudadSerializer(serializers.ModelSerializer):
    departamento_descripcion = serializers.CharField(source='departamento.descripcion', read_only=True)

    class Meta:
        model = Ciudad
        fields = ['id', 'descripcion', 'departamento', 'departamento_descripcion']

    def validate(self, data):
        descripcion = data.get('descripcion', getattr(self.instance, 'descripcion', None))
        departamento = data.get('departamento', getattr(self.instance, 'departamento', None))
        if descripcion and departamento:
            descripcion = descripcion.strip()
            qs = Ciudad.objects.filter(is_deleted=False, departamento=departamento)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.annotate(desc_lower=Lower('descripcion')).filter(desc_lower=descripcion.lower()).exists():
                raise serializers.ValidationError(
                    {'descripcion': 'Ya existe una ciudad con esa descripción en el departamento seleccionado.'}
                )
            data['descripcion'] = descripcion
        return data
