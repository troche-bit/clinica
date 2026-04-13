from django.db import migrations, models
import django.db.models.deletion
import django.db.models.functions.text
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("paciente", "0004_remove_pacienteresponsable_parentesco_and_more"),
        ("persona", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            # Registra el modelo en el estado de Django
            state_operations=[
                migrations.CreateModel(
                    name="PacienteResponsable",
                    fields=[
                        ("id", models.AutoField(primary_key=True, serialize=False)),
                        ("is_deleted", models.BooleanField(default=False)),
                        ("fecha_creacion", models.DateTimeField(auto_now_add=True)),
                        ("fecha_modificacion", models.DateTimeField(auto_now=True)),
                        ("fecha_eliminacion", models.DateTimeField(blank=True, null=True)),
                        ("id_usu_creator", models.ForeignKey(
                            blank=True, null=True,
                            on_delete=django.db.models.deletion.SET_NULL,
                            related_name="created_%(class)s",
                            to="auth.user",
                        )),
                        ("id_usu_modificator", models.ForeignKey(
                            blank=True, null=True,
                            on_delete=django.db.models.deletion.SET_NULL,
                            related_name="modified_%(class)s",
                            to="auth.user",
                        )),
                        ("persona", models.ForeignKey(
                            help_text="Persona a la que se le asigna el paciente responsable",
                            on_delete=django.db.models.deletion.PROTECT,
                            related_name="paciente_responsable",
                            to="persona.persona",
                        )),
                        ("grupo_sanguineo", models.CharField(blank=True, max_length=10, null=True)),
                        ("ocupacion", models.CharField(blank=True, max_length=150, null=True)),
                        ("es_contacto_emergencia", models.BooleanField(default=True)),
                        ("observacion", models.TextField(blank=True, null=True)),
                    ],
                    options={
                        "verbose_name": "Paciente Responsable",
                        "verbose_name_plural": "Pacientes Responsables",
                        "db_table": "paciente_pacienteresponsable",
                        "ordering": ["persona__nro_documento"],
                    },
                ),
            ],
            # Sin operaciones en la BD — la tabla ya existe
            database_operations=[],
        ),
    ]
