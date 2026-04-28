from rest_framework import serializers
from django.db.models.functions import Lower
from .models import TipoDocumento, Persona
from apps.mantenimiento.ubicacion.serializers import (
    PaisListSerializer, DepartamentoListSerializer, CiudadListSerializer
)


class TipoDocumentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoDocumento
        fields = ['id', 'descripcion']


class PersonaListSerializer(serializers.ModelSerializer):
    tipo_documento_detalle = TipoDocumentoSerializer(source='tipo_documento', read_only=True)
    pais_detalle = PaisListSerializer(source='pais', read_only=True)
    departamento_detalle = DepartamentoListSerializer(source='departamento', read_only=True)
    ciudad_detalle = CiudadListSerializer(source='ciudad', read_only=True)

    class Meta:
        model = Persona
        fields = [
            'id', 'tipo_documento', 'tipo_documento_detalle', 'nro_documento',
            'ruc_dv', 'razon_social', 'telefono', 'correo_electronico',
            'pais', 'pais_detalle', 'departamento', 'departamento_detalle',
            'ciudad', 'ciudad_detalle', 'direccion',
        ]


class PersonaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Persona
        fields = [
            'id', 'tipo_documento', 'nro_documento', 'ruc_dv', 'razon_social',
            'telefono', 'correo_electronico', 'pais', 'departamento', 'ciudad', 'direccion',
        ]

    def validate_nro_documento(self, value):
        valor = value.strip()
        qs = (
            Persona.objects
            .filter(is_deleted=False)
            .annotate(nro_lower=Lower('nro_documento'))
            .filter(nro_lower=valor.lower())
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("El número de documento ya existe.")
        return valor
