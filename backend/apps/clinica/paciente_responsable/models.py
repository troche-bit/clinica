from django.db import models
from django.db.models import Index, Q, UniqueConstraint
from apps.core.models import BaseModel
from apps.administracion.persona.models import Persona


class PacienteResponsable(BaseModel):
    persona = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        related_name="paciente_responsable",
        blank=False,
        null=False,
        help_text="Persona vinculada como responsable",
    )
    grupo_sanguineo        = models.CharField(max_length=10, blank=True, null=True)
    ocupacion              = models.CharField(max_length=150, blank=True, null=True)
    es_contacto_emergencia = models.BooleanField(default=True)
    observacion            = models.TextField(blank=True, null=True)

    class Meta:
        db_table          = "paciente_responsable"
        verbose_name      = "Paciente Responsable"
        verbose_name_plural = "Pacientes Responsables"
        ordering          = ["persona__nro_documento"]
        indexes           = [Index(fields=["persona"], name="idx_pac_resp_per")]
        constraints       = [
            UniqueConstraint(
                fields=["persona"],
                condition=Q(is_deleted=False),
                name="unique_responsable_persona",
            )
        ]

    def __str__(self):
        return f"{self.persona}"
