from django.contrib import admin
from .models import Pais, Departamento, Ciudad


@admin.register(Pais)
class PaisAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion')
    search_fields = ('descripcion',)
    ordering = ('descripcion',)


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion', 'pais__descripcion')
    search_fields = ('descripcion',)
    list_filter = ('pais',)
    ordering = ('descripcion',)


@admin.register(Ciudad)
class CiudadAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion', 'departamento__descripcion', 'departamento__pais__descripcion')
    search_fields = ('descripcion',)
    list_filter = ('departamento__pais', 'departamento',)
    ordering = ('descripcion',)
