from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('caja_banco', '0004_remove_vuelto'),
    ]

    operations = [
        migrations.AddField(
            model_name='movimientocajabanco',
            name='vuelto',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=18),
        ),
    ]
