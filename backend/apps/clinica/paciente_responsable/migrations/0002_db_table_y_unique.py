from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("paciente_responsable", "0001_initial"),
    ]

    operations = [
        migrations.AlterModelTable(
            name="pacienteresponsable",
            table="paciente_responsable",
        ),
        migrations.AddConstraint(
            model_name="pacienteresponsable",
            constraint=models.UniqueConstraint(
                condition=models.Q(is_deleted=False),
                fields=["persona"],
                name="unique_responsable_persona",
            ),
        ),
    ]
