from django.contrib import admin
from .models import Pais, Departamento, Ciudad

# Registrar los modelos en el admin de Django

@admin.register(Pais)
class PaisAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion') # Mostrar el ID y la descripción del país en la lista de administración
    search_fields = ('descripcion',)  # Permitir búsqueda por descripción del país
    ordering = ('descripcion',) # Ordenar por descripción del país

@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion', 'pais__descripcion') # Mostrar el nombre del país relacionado
    search_fields = ('descripcion',)   # Permitir búsqueda por descripción del departamento
    list_filter = ('pais',)  # Agregar filtro por país
    ordering = ('descripcion',) # Ordenar por descripción del departamento

@admin.register(Ciudad)
class CiudadAdmin(admin.ModelAdmin):
    list_display = ('id', 'descripcion', 'departamento__descripcion', 'departamento__pais__descripcion') # Mostrar el nombre del departamento y país relacionados
    search_fields = ('descripcion',) # Permitir búsqueda por descripción de la ciudad
    list_filter = ('departamento__pais', 'departamento',)  # Agregar filtro por país y departamento
    ordering = ('descripcion',) # Ordenar por descripción de la ciudad