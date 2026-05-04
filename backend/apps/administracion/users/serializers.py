from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework.exceptions import AuthenticationFailed
from .models import PerfilUsuario

User = get_user_model()


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        try:
            perfil = user.perfil
            token['rol'] = perfil.rol
            token['nombre'] = perfil.nombre_completo
            token['iniciales'] = perfil.iniciales
            token['activo'] = perfil.activo
            token['persona_rrhh_id'] = perfil.persona_rrhh_id
            token['medicos_asignados'] = list(
                perfil.medicos_asignados.values_list('id', flat=True)
            )
        except PerfilUsuario.DoesNotExist:
            token['rol'] = 'admin'
            token['nombre'] = user.username
            token['iniciales'] = user.username[:2].upper()
            token['activo'] = True
            token['persona_rrhh_id'] = None
            token['medicos_asignados'] = []
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        try:
            if not self.user.perfil.activo:
                raise AuthenticationFailed('Usuario desactivado. Contacte al administrador.')
        except PerfilUsuario.DoesNotExist:
            pass
        return data


class PerfilUsuarioSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    first_name = serializers.CharField(source='user.first_name', read_only=True)
    last_name = serializers.CharField(source='user.last_name', read_only=True)
    nombre_completo = serializers.CharField(read_only=True)
    iniciales = serializers.CharField(read_only=True)
    rol_display = serializers.CharField(source='get_rol_display', read_only=True)
    persona_rrhh_nombre = serializers.CharField(
        source='persona_rrhh.persona.razon_social', read_only=True
    )
    medicos_asignados_ids = serializers.SerializerMethodField()
    medicos_asignados_nombres = serializers.SerializerMethodField()
    es_master = serializers.SerializerMethodField()

    def get_medicos_asignados_ids(self, obj):
        return list(obj.medicos_asignados.values_list('id', flat=True))

    def get_medicos_asignados_nombres(self, obj):
        return [
            p.persona.razon_social
            for p in obj.medicos_asignados.select_related('persona').all()
        ]

    def get_es_master(self, obj):
        return obj.user.is_superuser

    class Meta:
        model = PerfilUsuario
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'nombre_completo', 'iniciales', 'rol', 'rol_display',
            'persona_rrhh', 'persona_rrhh_nombre',
            'medicos_asignados_ids', 'medicos_asignados_nombres',
            'activo', 'es_master',
        ]


class UsuarioCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, default='')
    last_name = serializers.CharField(max_length=150, required=False, default='')
    email = serializers.EmailField(required=False, default='')
    rol = serializers.ChoiceField(choices=PerfilUsuario.ROLES)
    persona_rrhh = serializers.IntegerField(required=False, allow_null=True)
    medicos_asignados = serializers.ListField(
        child=serializers.IntegerField(), required=False, default=list
    )

    def validate_username(self, value):
        value = value.strip()
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Ya existe un usuario con ese nombre de usuario.')
        return value

    def validate(self, data):
        if data.get('rol') != 'secretaria_medico':
            data['medicos_asignados'] = []
        return data

    def create(self, validated_data):
        persona_rrhh_id = validated_data.pop('persona_rrhh', None)
        medicos_asignados_ids = validated_data.pop('medicos_asignados', [])
        rol = validated_data.pop('rol')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        perfil, _ = PerfilUsuario.objects.get_or_create(user=user)
        perfil.rol = rol
        perfil.persona_rrhh_id = persona_rrhh_id
        perfil.save()
        if medicos_asignados_ids:
            perfil.medicos_asignados.set(medicos_asignados_ids)
        return perfil


class UsuarioUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    rol = serializers.ChoiceField(choices=PerfilUsuario.ROLES, required=False)
    persona_rrhh = serializers.IntegerField(required=False, allow_null=True)
    medicos_asignados = serializers.ListField(
        child=serializers.IntegerField(), required=False
    )

    def update(self, instance, validated_data):
        user = instance.user
        if 'first_name' in validated_data:
            user.first_name = validated_data['first_name']
        if 'last_name' in validated_data:
            user.last_name = validated_data['last_name']
        if 'email' in validated_data:
            user.email = validated_data['email']
        user.save()
        if 'rol' in validated_data:
            instance.rol = validated_data['rol']
        if 'persona_rrhh' in validated_data:
            instance.persona_rrhh_id = validated_data['persona_rrhh']
        instance.save()
        if 'medicos_asignados' in validated_data:
            if instance.rol != 'secretaria_medico':
                instance.medicos_asignados.clear()
            else:
                instance.medicos_asignados.set(validated_data['medicos_asignados'])
        return instance
