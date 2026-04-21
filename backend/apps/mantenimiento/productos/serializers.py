from rest_framework import serializers
from .models import Grupo, ProductoServicio


class GrupoSerializer(serializers.ModelSerializer):
    total_productos = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Grupo
        fields = [
            'id', 'descripcion', 'activo',
            'total_productos',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_modificacion']

    def validate_descripcion(self, value):
        qs = Grupo.objects.filter(
            descripcion__iexact=value,
            is_deleted=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un grupo con esa descripción.')
        return value


class ProductoServicioSerializer(serializers.ModelSerializer):
    grupo_nombre  = serializers.CharField(source='grupo.descripcion', read_only=True)
    impuesto_display = serializers.CharField(source='get_impuesto_display', read_only=True)

    class Meta:
        model  = ProductoServicio
        fields = [
            'id', 'descripcion', 'grupo', 'grupo_nombre',
            'impuesto', 'impuesto_display', 'activo',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['id', 'grupo_nombre', 'impuesto_display', 'fecha_creacion', 'fecha_modificacion']
