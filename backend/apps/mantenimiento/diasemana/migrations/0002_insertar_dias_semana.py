from django.db import migrations

def insertar_dias(apps, schema_editor):
    DiaSemana = apps.get_model('diasemana', 'DiaSemana')
    dias = [
        {'id': 1, 'descripcion': 'Lunes',      'abreviatura': 'LUN'},
        {'id': 2, 'descripcion': 'Martes',     'abreviatura': 'MAR'},
        {'id': 3, 'descripcion': 'Miércoles',  'abreviatura': 'MIE'},
        {'id': 4, 'descripcion': 'Jueves',     'abreviatura': 'JUE'},
        {'id': 5, 'descripcion': 'Viernes',    'abreviatura': 'VIE'},
        {'id': 6, 'descripcion': 'Sábado',     'abreviatura': 'SAB'},
        {'id': 7, 'descripcion': 'Domingo',    'abreviatura': 'DOM'},
    ]
    for dia in dias:
        DiaSemana.objects.create(**dia)

def revertir_dias(apps, schema_editor):
    DiaSemana = apps.get_model('diasemana', 'DiaSemana')
    DiaSemana.objects.all().delete()

class Migration(migrations.Migration):
    dependencies = [
        ('diasemana', '0001_initial'),
    ]
    operations = [
        migrations.RunPython(insertar_dias, revertir_dias),
    ]