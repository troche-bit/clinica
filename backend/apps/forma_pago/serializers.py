from rest_framework import serializers
from .models import FormaPago


class FormaPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FormaPago
        fields = ['id', 'descripcion', 'tipo']
