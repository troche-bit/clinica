from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("paciente", "0004_remove_pacienteresponsable_parentesco_and_more"),
        ("paciente_responsable", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                # Actualiza la FK de Paciente.responsable para apuntar al nuevo app
                migrations.AlterField(
                    model_name="paciente",
                    name="responsable",
                    field=models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="pacientes",
                        to="paciente_responsable.pacienteresponsable",
                        help_text="Responsable del paciente",
                    ),
                ),
                # Elimina PacienteResponsable del estado de paciente
                migrations.DeleteModel(name="PacienteResponsable"),
            ],
            # Sin operaciones en la BD — FK ya apunta a la misma tabla física
            database_operations=[],
        ),
    ]
