from decimal import Decimal
from rest_framework import serializers
from .models import VentaFactCab, VentaFactDet, VentaFactDetCobranza, CtaCobrar
# re-export para views
__all__ = [
    'VentaFactCabListSerializer',
    'VentaFactCabDetalleSerializer',
    'VentaFactCabUpdateSerializer',
    'VentaFactCreateSerializer',
]


# ── Serializers de lectura ────────────────────────────────────────────────────

class VentaFactDetSerializer(serializers.ModelSerializer):
    producto_descripcion = serializers.CharField(source='prs.descripcion', read_only=True)

    class Meta:
        model  = VentaFactDet
        fields = [
            'id', 'prs', 'producto_descripcion', 'cantidad', 'monto', 'impuesto',
            'exento', 'sub_gra_5', 'sub_gra_10', 'sub_iva_5', 'sub_iva_10',
        ]


class VentaFactCobranzaSerializer(serializers.ModelSerializer):
    forma_pago_descripcion = serializers.CharField(source='forma_pago.descripcion', read_only=True)
    forma_pago_tipo        = serializers.CharField(source='forma_pago.tipo', read_only=True)
    cuenta_descripcion     = serializers.CharField(source='cta.descripcion', read_only=True)

    class Meta:
        model  = VentaFactDetCobranza
        fields = [
            'id', 'forma_pago', 'forma_pago_descripcion', 'forma_pago_tipo',
            'cta', 'cuenta_descripcion', 'monto', 'voucher', 'nro_comprobante',
        ]


class CtaCobrarSerializer(serializers.ModelSerializer):
    class Meta:
        model  = CtaCobrar
        fields = [
            'id', 'nro_cuota', 'cant_cuota',
            'monto_total', 'monto_cuota', 'saldo',
            'fecha_vencimiento', 'estado',
        ]


class VentaFactCabListSerializer(serializers.ModelSerializer):
    cliente_nombre             = serializers.CharField(source='persona.razon_social', read_only=True)
    cliente_documento          = serializers.CharField(source='persona.nro_documento', read_only=True)
    condicion_vta_display      = serializers.SerializerMethodField()
    nro_comprobante_formateado = serializers.SerializerMethodField()

    class Meta:
        model  = VentaFactCab
        fields = [
            'id', 'fecha',
            'persona',                          # FK id — necesario para edición
            'establecimiento', 'expedicion',
            'nro_comprobante', 'nro_comprobante_formateado',
            'cliente_nombre', 'cliente_documento',
            'condicion_vta', 'condicion_vta_display',
            'observacion',
            'grav_5', 'grav_10', 'iva_5', 'iva_10',
            'total_gravada', 'total_iva', 'monto_total', 'vuelto',
            'fecha_creacion',
        ]

    def get_condicion_vta_display(self, obj):
        return 'Contado' if obj.condicion_vta else 'Crédito'

    def get_nro_comprobante_formateado(self, obj):
        if obj.nro_comprobante is None:
            return '—'
        # Usar los valores almacenados; fallback al timbrado para registros previos
        estab = obj.establecimiento if obj.establecimiento else str(obj.timbrado.punto_sucursal).zfill(3)
        expd  = obj.expedicion if obj.expedicion else str(obj.timbrado.punto_expedicion).zfill(3)
        return f'{estab}-{expd}-{str(obj.nro_comprobante).zfill(7)}'


class VentaFactCabUpdateSerializer(serializers.ModelSerializer):
    """Serializer para PATCH — solo campos editables después de emitida."""
    class Meta:
        model  = VentaFactCab
        fields = ['fecha', 'persona', 'observacion']


class VentaFactCabDetalleSerializer(VentaFactCabListSerializer):
    """Detalle completo de una factura."""
    detalle  = VentaFactDetSerializer(many=True, read_only=True)
    cobranza = VentaFactCobranzaSerializer(many=True, read_only=True)
    cuotas   = CtaCobrarSerializer(many=True, read_only=True)

    class Meta(VentaFactCabListSerializer.Meta):
        fields = VentaFactCabListSerializer.Meta.fields + [
            'observacion',
            'grav_5', 'grav_10', 'iva_5', 'iva_10',
            'total_gravada', 'total_iva', 'vuelto',
            'detalle', 'cobranza', 'cuotas',
        ]


# ── Serializers de escritura ──────────────────────────────────────────────────

class DetalleInputSerializer(serializers.Serializer):
    prs      = serializers.IntegerField()
    cantidad = serializers.DecimalField(max_digits=18, decimal_places=2)
    monto    = serializers.DecimalField(max_digits=18, decimal_places=2)


class CobranzaInputSerializer(serializers.Serializer):
    forma_pago      = serializers.IntegerField()
    cta             = serializers.IntegerField()
    monto           = serializers.DecimalField(max_digits=18, decimal_places=2)
    voucher         = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')
    nro_comprobante = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')


class CuotasInputSerializer(serializers.Serializer):
    cant_cuota        = serializers.IntegerField(min_value=1)
    dias_entre_cuotas = serializers.IntegerField(min_value=1)


class VentaFactCreateSerializer(serializers.Serializer):
    fecha           = serializers.DateField()
    condicion_vta   = serializers.BooleanField()
    persona         = serializers.IntegerField()
    timbrado        = serializers.IntegerField()
    observacion     = serializers.CharField(required=False, allow_blank=True, default='')
    nro_comprobante = serializers.IntegerField()

    detalle  = DetalleInputSerializer(many=True)
    cobranza = CobranzaInputSerializer(many=True, required=False, default=list)
    cuotas   = CuotasInputSerializer(required=False, allow_null=True, default=None)

    def validate_detalle(self, value):
        if not value:
            raise serializers.ValidationError('Debe incluir al menos un ítem en el detalle.')
        return value

    def validate(self, data):
        if data['condicion_vta']:
            if not data.get('cobranza'):
                raise serializers.ValidationError(
                    {'cobranza': 'Operación al contado requiere al menos un registro de cobranza.'}
                )
        else:
            if not data.get('cuotas'):
                raise serializers.ValidationError(
                    {'cuotas': 'Operación a crédito requiere datos de cuotas.'}
                )
        return data
