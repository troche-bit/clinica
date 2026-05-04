from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('facturacion', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='ventafactcab',
            name='establecimiento',
            field=models.CharField(blank=True, default='', help_text='Punto de sucursal copiado del timbrado al emitir', max_length=3),
        ),
        migrations.AddField(
            model_name='ventafactcab',
            name='expedicion',
            field=models.CharField(blank=True, default='', help_text='Punto de expedición copiado del timbrado al emitir', max_length=3),
        ),
    ]
