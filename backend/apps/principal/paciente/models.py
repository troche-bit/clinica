from django.db import models
from django.db.models import UniqueConstraint, Q, Index
from django.contrib.auth.models import User
from apps.core.models import BaseModel
from apps.persona.models import Persona
# PacienteResponsable ahora vive en su propio módulo
from apps.principal.paciente_responsable.models import PacienteResponsable  # noqa: F401


class Paciente(BaseModel):
    id = models.AutoField(primary_key=True)

    persona = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        related_name="paciente",
        blank=False,
        null=False,
        help_text="Persona a la que se le asigna el paciente",
    )

    fecha_nacimiento = models.DateField(
        blank=False,
        null=False,
        help_text="Fecha de nacimiento del paciente",
    )

    responsable = models.ForeignKey(
        PacienteResponsable,
        on_delete=models.PROTECT,
        related_name="pacientes",
        blank=True,
        null=True,
        help_text="Responsable del paciente",
    )

    class Sexo(models.TextChoices):
        MASCULINO = "M", "Masculino"
        FEMENINO  = "F", "Femenino"
        OTRO      = "O", "Otro"

    sexo = models.CharField(
        max_length=1,
        choices=Sexo.choices,
        blank=False,
        null=False,
        help_text="Sexo del paciente",
    )

    observacion = models.CharField(
        max_length=5000,
        blank=True,
        null=True,
        help_text="Observaciones adicionales sobre el paciente",
    )

    grupo_sanguineo = models.CharField(
        max_length=10,
        blank=True,
        null=True,
        help_text="Grupo sanguineo del paciente",
    )

    alergias_conocidas = models.TextField(
        blank=True,
        null=True,
        help_text="Alergias conocidas del paciente",
    )

    enfermedades_cronicas = models.TextField(
        blank=True,
        null=True,
        help_text="Enfermedades cronicas del paciente",
    )

    parentesco = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Parentesco con el paciente responsable",
    )

    class Meta:
        verbose_name        = "Paciente"
        verbose_name_plural = "Pacientes"
        ordering            = ["persona__nro_documento"]
        indexes             = [Index(fields=["persona"], name="idx_paciente_persona")]
        constraints         = [
            UniqueConstraint(
                fields=["persona"],
                name="unique_paciente_persona",
                condition=Q(is_deleted=False),
            )
        ]

    def __str__(self):
        return f"{self.persona}"
