from rest_framework import serializers
from .models import DiaSemana


class DiaSemanaSerializer(serializers.ModelSerializer):
    class Meta:
        model  = DiaSemana
        fields = ['id', 'descripcion', 'abreviatura']
