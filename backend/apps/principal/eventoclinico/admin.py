from django.contrib import admin
from .models import EventoClinico

# Registrar los modelos en el admin de Django

@admin.register(EventoClinico)
class ConsultorioAdmin(admin.ModelAdmin):
    list_display = ('id', 'tipo_evento') 
    search_fields = ('tipo_evento',)  
    ordering = ('tipo_evento',) 