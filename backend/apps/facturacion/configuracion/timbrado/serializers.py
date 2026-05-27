from rest_framework import serializers
from django.utils import timezone
from .models import Timbrado


class TimbradoListSerializer(serializers.ModelSerializer):
    vigente            = serializers.SerializerMethodField()
    tipo               = serializers.SerializerMethodField()
    dias_restantes     = serializers.SerializerMethodField()
    total_comprobantes = serializers.SerializerMethodField()

    class Meta:
        model  = Timbrado
        fields = [
            'id',
            'nro_timbrado', 'autoimpresor', 'tipo',
            'inicio_vigencia', 'fin_vigencia',
            'punto_sucursal', 'punto_expedicion',
            'nro_desde', 'nro_hasta',
            'nro_habilitacion',
            'vigente', 'dias_restantes', 'total_comprobantes',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']

    def get_vigente(self, obj):
        return obj.vigente

    def get_tipo(self, obj):
        return obj.tipo

    def get_dias_restantes(self, obj):
        return (obj.fin_vigencia - timezone.localtime().date()).days

    def get_total_comprobantes(self, obj):
        return obj.nro_hasta - obj.nro_desde + 1


class TimbradoSerializer(serializers.ModelSerializer):

    def validate_nro_timbrado(self, value):
        value = value.strip()
        if not value.isdigit():
            raise serializers.ValidationError('Solo se permiten dígitos numéricos.')
        return value

    def validate_punto_sucursal(self, value):
        value = value.strip()
        if not value.isdigit() or len(value) != 3:
            raise serializers.ValidationError('Debe ser exactamente 3 dígitos numéricos (ej: 001).')
        return value

    def validate_punto_expedicion(self, value):
        value = value.strip()
        if not value.isdigit() or len(value) != 3:
            raise serializers.ValidationError('Debe ser exactamente 3 dígitos numéricos (ej: 001).')
        return value

    def validate(self, data):
        inst   = self.instance
        nro    = data.get('nro_timbrado',    getattr(inst, 'nro_timbrado',    None))
        inicio = data.get('inicio_vigencia', getattr(inst, 'inicio_vigencia', None))
        fin    = data.get('fin_vigencia',    getattr(inst, 'fin_vigencia',    None))
        desde  = data.get('nro_desde',       getattr(inst, 'nro_desde',       None))
        hasta  = data.get('nro_hasta',       getattr(inst, 'nro_hasta',       None))
        suc    = data.get('punto_sucursal',   getattr(inst, 'punto_sucursal',   None))
        exp    = data.get('punto_expedicion', getattr(inst, 'punto_expedicion', None))
        auto   = data.get('autoimpresor',     getattr(inst, 'autoimpresor',     False))
        habili = data.get('nro_habilitacion', getattr(inst, 'nro_habilitacion', ''))

        if inicio and fin and fin <= inicio:
            raise serializers.ValidationError(
                {'fin_vigencia': 'La fecha de fin debe ser posterior a la de inicio.'}
            )
        if desde is not None and hasta is not None and hasta <= desde:
            raise serializers.ValidationError(
                {'nro_hasta': 'El número hasta debe ser mayor al número desde.'}
            )
        if auto and not habili:
            raise serializers.ValidationError(
                {'nro_habilitacion': 'Requerido para timbrado autoimpresor.'}
            )

        if all(v is not None for v in [nro, inicio, fin, suc, exp, desde, hasta]):
            qs = Timbrado.objects.filter(
                is_deleted=False,
                nro_timbrado=nro,
                inicio_vigencia=inicio,
                fin_vigencia=fin,
                punto_sucursal=suc,
                punto_expedicion=exp,
                nro_desde=desde,
                nro_hasta=hasta,
            )
            if inst:
                qs = qs.exclude(pk=inst.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    'Ya existe un timbrado activo con el mismo número, fechas de vigencia y punto de emisión.'
                )

        return data

    class Meta:
        model      = Timbrado
        validators = []
        fields = [
            'id', 'nro_timbrado', 'autoimpresor',
            'inicio_vigencia', 'fin_vigencia',
            'punto_sucursal', 'punto_expedicion',
            'nro_desde', 'nro_hasta',
            'nro_habilitacion',
        ]
