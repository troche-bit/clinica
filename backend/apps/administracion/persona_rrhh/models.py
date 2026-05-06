from django.db import models
from django.db.models import Index
from django.core.validators import MinValueValidator
from apps.core.models import BaseModel
from apps.administracion.persona.models import Persona
from apps.clinica.configuracion.especialidad.models import Especialidad


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

    persona = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        related_name="persona_rrhh",
        blank=False,
        null=False,
    )
    fecha_ingreso    = models.DateField(blank=True, null=True)
    nro_matricula    = models.CharField(max_length=50, blank=True, null=True)
    especialidades   = models.ManyToManyField(
        Especialidad,
        blank=True,
        related_name="prestadores",
    )
    cargo          = models.CharField(max_length=20, choices=Cargo.choices)
    tipo_contrato  = models.CharField(max_length=20, choices=TipoContrato.choices)
    estado         = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ACTIVO)
    honorario      = models.DecimalField(max_digits=14, decimal_places=2, blank=True, null=True,
                                         validators=[MinValueValidator(0)])
    observacion    = models.TextField(blank=True, null=True)

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
            ),
            models.UniqueConstraint(
                fields=["nro_matricula"],
                name="unique_rrhh_nro_matricula",
                condition=models.Q(is_deleted=False, nro_matricula__isnull=False),
            ),
        ]

    def __str__(self):
        return f"{self.persona} — {self.get_cargo_display()}"
