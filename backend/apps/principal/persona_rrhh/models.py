from django.db import models
from django.db.models import Index
from apps.core.models import BaseModel
from apps.persona.models import Persona
from apps.administracion.especialidad.models import Especialidad


class PersonaRRHH(BaseModel):

    class Cargo(models.TextChoices):
        MEDICO         = "medico",         "Médico"
        ENFERMERO      = "enfermero",      "Enfermero/a"
        ADMINISTRATIVO = "administrativo", "Administrativo"
        TECNICO        = "tecnico",        "Técnico"
        OTRO           = "otro",           "Otro"

    class TipoContrato(models.TextChoices):
        DEPENDENCIA = "dependencia", "Dependencia"
        HONORARIOS  = "honorarios",  "Honorarios"
        EVENTUAL    = "eventual",    "Eventual"

    class Estado(models.TextChoices):
        ACTIVO   = "activo",   "Activo"
        INACTIVO = "inactivo", "Inactivo"
        LICENCIA = "licencia", "Licencia"

    id = models.AutoField(primary_key=True)

    persona = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        related_name="persona_rrhh",
        blank=False,
        null=False,
        help_text="Persona asociada al prestador",
    )

    fecha_nacimiento = models.DateField(
        blank=True,
        null=True,
        help_text="Fecha de nacimiento del prestador",
    )

    fecha_ingreso = models.DateField(
        blank=True,
        null=True,
        help_text="Fecha de ingreso a la institución",
    )

    nro_matricula = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        help_text="Número de matrícula profesional",
    )

    especialidades = models.ManyToManyField(
        Especialidad,
        blank=True,
        related_name="prestadores",
        help_text="Especialidades del prestador",
    )

    cargo = models.CharField(
        max_length=20,
        choices=Cargo.choices,
        blank=False,
        null=False,
        help_text="Cargo del prestador",
    )

    tipo_contrato = models.CharField(
        max_length=20,
        choices=TipoContrato.choices,
        blank=False,
        null=False,
        help_text="Tipo de contrato",
    )

    estado = models.CharField(
        max_length=10,
        choices=Estado.choices,
        default=Estado.ACTIVO,
        blank=False,
        null=False,
        help_text="Estado del prestador",
    )

    honorario = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        blank=True,
        null=True,
        help_text="Monto de honorario referencial del prestador",
    )

    observacion = models.TextField(
        blank=True,
        null=True,
        help_text="Observaciones adicionales",
    )

    class Meta:
        db_table            = "persona_rrhh"
        verbose_name        = "Persona RRHH"
        verbose_name_plural = "Personas RRHH"
        ordering            = ["persona__nro_documento"]
        indexes             = [Index(fields=["persona"], name="idx_rrhh_persona")]
        constraints         = [
            models.UniqueConstraint(
                fields=["persona"],
                name="unique_rrhh_persona",
                condition=models.Q(is_deleted=False),
            )
        ]

    def __str__(self):
        return f"{self.persona} — {self.get_cargo_display()}"
