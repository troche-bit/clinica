from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import DiaSemana
from .serializers import DiaSemanaSerializer

class DiaSemanaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset           = DiaSemana.objects.all()
    serializer_class   = DiaSemanaSerializer
    permission_classes = [IsAuthenticated]from django.shortcuts import render
