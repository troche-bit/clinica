import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Adopta CtaCobrar desde el app facturacion.
    La tabla cta_cobrar ya existe (creada por facturacion/0001_initial).
    SeparateDatabaseAndState actualiza el estado de Django sin tocar la DB.
    """

    initial = True

    dependencies = [
        ('facturacion', '0002_ventafactcab_establecimiento_expedicion'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='CtaCobrar',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                        ('fecha_modificacion', models.DateTimeField(auto_now=True)),
                        ('is_deleted', models.BooleanField(default=False)),
                        ('fecha_eliminacion', models.DateTimeField(blank=True, null=True)),
                        ('nro_cuota', models.PositiveIntegerField()),
                        ('cant_cuota', models.PositiveIntegerField()),
                        ('monto_total', models.DecimalField(decimal_places=2, max_digits=18)),
                        ('monto_cuota', models.DecimalField(decimal_places=2, max_digits=18)),
                        ('saldo', models.DecimalField(decimal_places=2, max_digits=18)),
                        ('fecha_vencimiento', models.DateField()),
                        ('estado', models.CharField(choices=[('pendiente', 'Pendiente'), ('pagado', 'Pagado'), ('vencido', 'Vencido')], default='pendiente', max_length=20)),
                        ('id_usu_creator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='created_%(class)s', to=settings.AUTH_USER_MODEL)),
                        ('id_usu_modificator', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='modified_%(class)s', to=settings.AUTH_USER_MODEL)),
                        ('vfc', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='cuotas', to='facturacion.ventafactcab')),
                    ],
                    options={
                        'verbose_name': 'Cuota a cobrar',
                        'verbose_name_plural': 'Cuotas a cobrar',
                        'db_table': 'cta_cobrar',
                        'ordering': ['vfc', 'nro_cuota'],
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
