from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError
from django.utils import timezone
from .models import Pais, Departamento, Ciudad
from .serializers import PaisSerializer, DepartamentoSerializer, CiudadSerializer


class PaisViewSet(viewsets.ModelViewSet):
    # Solo registros activos
    queryset = Pais.objects.filter(is_deleted=False)
    serializer_class = PaisSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descripcion"]
    ordering_fields = ["descripcion"]

    # Auditoría: registra el usuario que crea el país
    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    # Auditoría: registra el usuario que modifica el país
    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # Borrado lógico con verificación de dependencias activas
    def perform_destroy(self, instance):
        if instance.departamentos.filter(is_deleted=False).exists():
            raise ValidationError(
                "No se puede eliminar: el país tiene departamentos activos asociados."
            )
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError(
                "No se puede eliminar: el país tiene personas activas asociadas."
            )
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # Endpoint adicional: lista los países eliminados lógicamente
    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = Pais.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class DepartamentoViewSet(viewsets.ModelViewSet):
    serializer_class = DepartamentoSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descripcion"]
    ordering_fields = ["descripcion"]

    def get_queryset(self):
        # Solo registros activos; filtra por país si se pasa el parámetro ?pais=ID
        queryset = Departamento.objects.filter(is_deleted=False).select_related("pais")
        pais_id = self.request.query_params.get("pais")
        if pais_id:
            queryset = queryset.filter(pais_id=pais_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # Borrado lógico con verificación de dependencias activas
    def perform_destroy(self, instance):
        if instance.ciudades.filter(is_deleted=False).exists():
            raise ValidationError(
                "No se puede eliminar: el departamento tiene ciudades activas asociadas."
            )
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError(
                "No se puede eliminar: el departamento tiene personas activas asociadas."
            )
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # Endpoint adicional: lista los departamentos eliminados lógicamente
    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = Departamento.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class CiudadViewSet(viewsets.ModelViewSet):
    serializer_class = CiudadSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["descripcion"]
    ordering_fields = ["descripcion"]

    def get_queryset(self):
        # Solo registros activos; filtra por departamento si se pasa el parámetro ?departamento=ID
        queryset = Ciudad.objects.filter(is_deleted=False).select_related("departamento__pais")
        departamento_id = self.request.query_params.get("departamento")
        if departamento_id:
            queryset = queryset.filter(departamento_id=departamento_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(id_usu_creator=self.request.user)

    def perform_update(self, serializer):
        serializer.save(id_usu_modificator=self.request.user)

    # Borrado lógico con verificación de dependencias activas
    def perform_destroy(self, instance):
        if instance.personas.filter(is_deleted=False).exists():
            raise ValidationError(
                "No se puede eliminar: la ciudad tiene personas activas asociadas."
            )
        instance.is_deleted = True
        instance.fecha_eliminacion = timezone.now()
        instance.id_usu_modificator = self.request.user
        instance.save()

    # Endpoint adicional: lista las ciudades eliminadas lógicamente
    @action(detail=False, methods=["get"], url_path="eliminados")
    def eliminados(self, request):
        qs = Ciudad.objects.filter(is_deleted=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
