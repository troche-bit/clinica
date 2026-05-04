from rest_framework import serializers
from .models import CuentaMcb, MovimientoCajaBanco


class CuentaMcbListSerializer(serializers.ModelSerializer):
    saldo             = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    total_movimientos = serializers.IntegerField(read_only=True)

    class Meta:
        model  = CuentaMcb
        fields = [
            'id', 'descripcion',
            'saldo', 'total_movimientos',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['id', 'fecha_creacion', 'fecha_modificacion']


class CuentaMcbSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CuentaMcb
        fields = ['id', 'descripcion']
        read_only_fields = ['id']

    def validate_descripcion(self, value):
        qs = CuentaMcb.objects.filter(descripcion__iexact=value, is_deleted=False)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe una cuenta con esa descripción.')
        return value


class MovimientoCajaBancoListSerializer(serializers.ModelSerializer):
    tipo        = serializers.SerializerMethodField()
    cta_detalle = serializers.CharField(source='cta.descripcion', read_only=True)

    class Meta:
        model  = MovimientoCajaBanco
        fields = [
            'id', 'cta', 'cta_detalle',
            'fecha', 'voucher',
            'monto_ingreso', 'monto_egreso', 'vuelto',
            'tipo',
            'vfdc_id', 'vrc_id', 'ppdc_id',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = [
            'id', 'tipo', 'cta_detalle',
            'vfdc_id', 'vrc_id', 'ppdc_id',
            'fecha_creacion', 'fecha_modificacion',
        ]

    def get_tipo(self, obj):
        return obj.tipo


class MovimientoCajaBancoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MovimientoCajaBanco
        fields = ['id', 'cta', 'fecha', 'voucher', 'monto_ingreso', 'monto_egreso', 'vuelto']
        read_only_fields = ['id']

    def validate(self, data):
        ing = data.get('monto_ingreso', 0) or 0
        egr = data.get('monto_egreso', 0) or 0
        if ing == 0 and egr == 0:
            raise serializers.ValidationError('Debe ingresar monto de ingreso o egreso.')
        if ing > 0 and egr > 0:
            raise serializers.ValidationError('Solo puede tener ingreso o egreso, no ambos.')
        return data
