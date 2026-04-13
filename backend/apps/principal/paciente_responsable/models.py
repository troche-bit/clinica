from django.db import models
from django.db.models import Index
from apps.core.models import BaseModel
from apps.persona.models import Persona


class PacienteResponsable(BaseModel):
    id = models.AutoField(primary_key=True)

    persona = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        related_name="paciente_responsable",
        blank=False,
        null=False,
        help_text="Persona a la que se le asigna el paciente responsable"
    )

    grupo_sanguineo = models.CharField(
        max_length=10, blank=True, null=True,
        help_text="Grupo sanguineo del paciente responsable"
    )

    ocupacion = models.CharField(
        max_length=150, blank=True, null=True,
        help_text="Ocupación del paciente responsable"
    )

    es_contacto_emergencia = models.BooleanField(default=True)

    observacion = models.TextField(blank=True, null=True)

    class Meta:
        # Preserva la tabla existente — sin migraciones destructivas
        db_table = "paciente_pacienteresponsable"
        verbose_name = "Paciente Responsable"
        verbose_name_plural = "Pacientes Responsables"
        ordering = ["persona__nro_documento"]
        indexes = [
            Index(fields=["persona"], name="idx_pac_resp_per"),
        ]

    def __str__(self):
        return f"{self.persona}"
