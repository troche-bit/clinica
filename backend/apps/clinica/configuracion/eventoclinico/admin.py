from django.contrib import admin
from .models import EventoClinico


@admin.register(EventoClinico)
class EventoClinicoAdmin(admin.ModelAdmin):
    list_display = ('id', 'tipo_evento')
    search_fields = ('tipo_evento',)
    ordering = ('tipo_evento',)
