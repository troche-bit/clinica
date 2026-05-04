from django.contrib import admin
from .models import Agenda


@admin.register(Agenda)
class AgendaAdmin(admin.ModelAdmin):
    list_display  = ['fecha', 'hora_desde', 'hora_hasta', 'estado', 'paciente', 'horario_prestador']
    list_filter   = ['estado', 'fecha']
    search_fields = ['paciente__persona__razon_social']
    ordering      = ['fecha', 'hora_desde']
