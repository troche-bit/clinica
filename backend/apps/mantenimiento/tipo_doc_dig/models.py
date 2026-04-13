from django.db import models
from django.db.models import UniqueConstraint, Q, Index
from django.db.models.functions import Lower
from apps.core.models import BaseModel


class TipoDocDigital(BaseModel):
    descripcion = models.CharField(
        max_length=100,
        blank=False,
        null=False,
        help_text="Nombre descriptivo del tipo de documento (ej: Historia Clínica, Receta)"
    )
    # Clave usada para construir rutas de almacenamiento de archivos.
    # IMPORTANTE: no modificar una vez que existen documentos de este tipo.
    # Ejemplo: "historia_clinica" → documentos/historia_clinica/2025/...
    storage_key = models.SlugField(
        max_length=50,
        blank=False,
        null=False,
        help_text="Clave de almacenamiento para rutas de archivos. Solo minúsculas, números y guiones bajos."
    )

    class Meta:
        db_table = "tipo_doc_dig"
        verbose_name = "Tipo de documento digitalizado"
        verbose_name_plural = "Tipos de documento digitalizado"
        ordering = ["descripcion"]
        indexes = [
            Index(fields=["descripcion", "is_deleted"], name="idx_tipo_doc_dig_desc_del"),
        ]
        constraints = [
            # Unicidad case-insensitive sobre descripcion (solo registros activos)
            UniqueConstraint(
                Lower("descripcion"),
                name="unique_tipo_doc_dig_descripcion",
                condition=Q(is_deleted=False)
            ),
            # Unicidad de storage_key (solo registros activos)
            # SlugField ya es lowercase, no necesita Lower()
            UniqueConstraint(
                fields=["storage_key"],
                name="unique_tipo_doc_dig_storage_key",
                condition=Q(is_deleted=False)
            ),
        ]

    def __str__(self):
        return self.descripcion
