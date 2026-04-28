from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("paciente", "0005_move_pacienteresponsable"),
    ]

    operations = [
        migrations.AlterModelTable(
            name="paciente",
            table="paciente",
        ),
    ]
