from rest_framework import serializers
from .models import Grupo, ProductoServicio


class GrupoListSerializer(serializers.ModelSerializer):
    total_productos = serializers.IntegerField(read_only=True)

    class Meta:
        model  = Grupo
        fields = [
            'id', 'descripcion', 'activo',
            'total_productos',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['id', 'total_productos', 'fecha_creacion', 'fecha_modificacion']


class GrupoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Grupo
        fields = ['id', 'descripcion', 'activo']
        read_only_fields = ['id']

    def validate_descripcion(self, value):
        value = value.strip()
        qs = Grupo.objects.filter(descripcion__iexact=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un grupo con esa descripción.')
        return value


class ProductoServicioListSerializer(serializers.ModelSerializer):
    grupo_nombre     = serializers.CharField(source='grupo.descripcion', read_only=True)
    impuesto_display = serializers.CharField(source='get_impuesto_display', read_only=True)

    class Meta:
        model  = ProductoServicio
        fields = [
            'id', 'descripcion', 'grupo', 'grupo_nombre',
            'impuesto', 'impuesto_display', 'activo',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['id', 'grupo_nombre', 'impuesto_display', 'fecha_creacion', 'fecha_modificacion']


class ProductoServicioSerializer(serializers.ModelSerializer):

    def validate_descripcion(self, value):
        return value.strip()

    def validate(self, data):
        descripcion = data.get('descripcion', getattr(self.instance, 'descripcion', None))
        grupo       = data.get('grupo',       getattr(self.instance, 'grupo',       None))
        if descripcion and grupo:
            qs = ProductoServicio.objects.filter(
                descripcion__iexact=descripcion,
                grupo=grupo,
                is_deleted=False,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {'descripcion': 'Ya existe un producto con esa descripción en este grupo.'}
                )
        return data

    class Meta:
        model  = ProductoServicio
        fields = ['id', 'descripcion', 'grupo', 'impuesto', 'activo']
        read_only_fields = ['id']
