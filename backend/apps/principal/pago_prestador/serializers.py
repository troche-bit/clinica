from rest_framework import serializers
from .models import PagoPrestador, PagoPrestadorDetCobranza


class PagoPrestadorDetSerializer(serializers.ModelSerializer):
    forma_pago_descripcion = serializers.CharField(source='forma_pago.descripcion', read_only=True)
    cuenta_descripcion     = serializers.CharField(source='cta.descripcion', read_only=True)

    class Meta:
        model  = PagoPrestadorDetCobranza
        fields = ['id', 'forma_pago', 'forma_pago_descripcion', 'cta', 'cuenta_descripcion', 'monto', 'voucher']


class PagoPrestadorListSerializer(serializers.ModelSerializer):
    medico_nombre = serializers.SerializerMethodField()
    estado_display = serializers.SerializerMethodField()

    class Meta:
        model  = PagoPrestador
        fields = [
            'id', 'fecha_pago', 'persona_rrhh', 'medico_nombre',
            'monto_hora', 'total_hora', 'monto_total', 'saldo',
            'estado', 'estado_display', 'fecha_creacion',
        ]

    def get_medico_nombre(self, obj):
        return obj.persona_rrhh.persona.razon_social

    def get_estado_display(self, obj):
        return dict(PagoPrestador.ESTADO_CHOICES).get(obj.estado, obj.estado)


class PagoPrestadorDetalleSerializer(PagoPrestadorListSerializer):
    detalle_cobranza = PagoPrestadorDetSerializer(many=True, read_only=True)

    class Meta(PagoPrestadorListSerializer.Meta):
        fields = PagoPrestadorListSerializer.Meta.fields + ['detalle_cobranza']


# ── Serializers de escritura ──────────────────────────────────────────────────

class BloqueInputSerializer(serializers.Serializer):
    horario_prestador_id = serializers.IntegerField()
    fecha                = serializers.DateField()
    horas                = serializers.DecimalField(max_digits=6, decimal_places=2)
    agenda_ids           = serializers.ListField(child=serializers.IntegerField())


class ValorPagadoInputSerializer(serializers.Serializer):
    forma_pago_id = serializers.IntegerField()
    cta_id        = serializers.IntegerField()
    monto         = serializers.DecimalField(max_digits=18, decimal_places=2)
    voucher       = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')


class PagoPrestadorCreateSerializer(serializers.Serializer):
    persona_rrhh_id = serializers.IntegerField()
    fecha_pago      = serializers.DateField()
    monto_hora      = serializers.DecimalField(max_digits=18, decimal_places=2)
    bloques         = BloqueInputSerializer(many=True)
    valores_pagados = ValorPagadoInputSerializer(many=True)

    def validate_bloques(self, value):
        if not value:
            raise serializers.ValidationError('Debe incluir al menos un bloque.')
        return value

    def validate_valores_pagados(self, value):
        if not value:
            raise serializers.ValidationError('Debe incluir al menos un valor de pago.')
        return value
