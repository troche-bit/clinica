from rest_framework import serializers
from .models import Cobranza, CobranzaDet, ValorRecibidoCob


class CobranzaDetLecturaSerializer(serializers.ModelSerializer):
    factura_nro       = serializers.SerializerMethodField()
    cuota_display     = serializers.SerializerMethodField()
    fecha_vencimiento = serializers.DateField(source='cta_cobrar.fecha_vencimiento', read_only=True)

    class Meta:
        model  = CobranzaDet
        fields = [
            'id', 'cta_cobrar', 'factura_nro', 'cuota_display',
            'fecha_vencimiento', 'monto_total', 'monto_pagado', 'nro_comprobante',
        ]

    def get_factura_nro(self, obj):
        vfc   = obj.cta_cobrar.vfc
        estab = vfc.establecimiento if vfc.establecimiento else str(vfc.timbrado.punto_sucursal).zfill(3)
        expd  = vfc.expedicion if vfc.expedicion else str(vfc.timbrado.punto_expedicion).zfill(3)
        return f'{estab}-{expd}-{str(vfc.nro_comprobante).zfill(7)}'

    def get_cuota_display(self, obj):
        c = obj.cta_cobrar
        return f'{c.nro_cuota}/{c.cant_cuota}'


class ValorRecibidoLecturaSerializer(serializers.ModelSerializer):
    forma_pago_descripcion = serializers.CharField(source='forma_pago.descripcion', read_only=True)
    forma_pago_tipo        = serializers.CharField(source='forma_pago.tipo', read_only=True)
    cuenta_descripcion     = serializers.CharField(source='cta.descripcion', read_only=True)

    class Meta:
        model  = ValorRecibidoCob
        fields = [
            'id', 'forma_pago', 'forma_pago_descripcion', 'forma_pago_tipo',
            'cta', 'cuenta_descripcion', 'monto', 'voucher', 'nro_comprobante',
        ]


class CobranzaListSerializer(serializers.ModelSerializer):
    cliente_nombre    = serializers.CharField(source='persona.razon_social', read_only=True)
    cliente_documento = serializers.CharField(source='persona.nro_documento', read_only=True)

    class Meta:
        model  = Cobranza
        fields = [
            'id', 'fecha', 'comprobante_nro',
            'persona', 'cliente_nombre', 'cliente_documento',
            'monto', 'vuelto', 'fecha_creacion',
        ]


class CobranzaDetalleSerializer(CobranzaListSerializer):
    detalle           = CobranzaDetLecturaSerializer(many=True, read_only=True)
    valores_recibidos = ValorRecibidoLecturaSerializer(many=True, read_only=True)

    class Meta(CobranzaListSerializer.Meta):
        fields = CobranzaListSerializer.Meta.fields + ['detalle', 'valores_recibidos']


class CobranzaDetInputSerializer(serializers.Serializer):
    cta_cobrar_id   = serializers.IntegerField()
    monto_pagado    = serializers.DecimalField(max_digits=18, decimal_places=2)
    nro_comprobante = serializers.CharField(max_length=200, required=False, allow_blank=True, default='')


class ValorRecibidoInputSerializer(serializers.Serializer):
    forma_pago_id   = serializers.IntegerField()
    cta_id          = serializers.IntegerField()
    monto           = serializers.DecimalField(max_digits=18, decimal_places=2)
    voucher         = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    nro_comprobante = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')


class CobranzaCreateSerializer(serializers.Serializer):
    fecha             = serializers.DateField()
    persona           = serializers.IntegerField()
    detalle           = CobranzaDetInputSerializer(many=True)
    valores_recibidos = ValorRecibidoInputSerializer(many=True)

    def validate_detalle(self, value):
        if not value:
            raise serializers.ValidationError('Debe incluir al menos una cuota en el detalle.')
        return value

    def validate_valores_recibidos(self, value):
        if not value:
            raise serializers.ValidationError('Debe incluir al menos un valor recibido.')
        return value
