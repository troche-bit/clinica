import django.db.models.functions.text
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('persona', '0004_alter_persona_options_alter_tipodocumento_options'),
    ]

    operations = [
        migrations.AlterModelTable(
            name='tipodocumento',
            table='tipo_documento',
        ),
        migrations.AlterModelTable(
            name='persona',
            table='persona',
        ),
        migrations.RemoveConstraint(
            model_name='tipodocumento',
            name='unique_tipo_documento_descripcion',
        ),
        migrations.AddConstraint(
            model_name='tipodocumento',
            constraint=models.UniqueConstraint(
                django.db.models.functions.text.Lower('descripcion'),
                condition=models.Q(is_deleted=False),
                name='unique_tipo_documento_descripcion',
            ),
        ),
    ]
