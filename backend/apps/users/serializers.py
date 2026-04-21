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
            token['medico_asignado_id'] = perfil.medico_asignado_id
        except PerfilUsuario.DoesNotExist:
            token['rol'] = 'admin'
            token['nombre'] = user.username
            token['iniciales'] = user.username[:2].upper()
            token['activo'] = True
            token['persona_rrhh_id'] = None
            token['medico_asignado_id'] = None
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
    medico_asignado_nombre = serializers.CharField(
        source='medico_asignado.persona.razon_social', read_only=True
    )

    class Meta:
        model = PerfilUsuario
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'nombre_completo', 'iniciales', 'rol', 'rol_display',
            'persona_rrhh', 'persona_rrhh_nombre',
            'medico_asignado', 'medico_asignado_nombre',
            'activo',
        ]


class UsuarioCreateSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, default='')
    last_name = serializers.CharField(max_length=150, required=False, default='')
    email = serializers.EmailField(required=False, default='')
    rol = serializers.ChoiceField(choices=PerfilUsuario.ROLES)
    persona_rrhh = serializers.IntegerField(required=False, allow_null=True)
    medico_asignado = serializers.IntegerField(required=False, allow_null=True)

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('Ya existe un usuario con ese nombre de usuario.')
        return value

    def create(self, validated_data):
        persona_rrhh_id = validated_data.pop('persona_rrhh', None)
        medico_asignado_id = validated_data.pop('medico_asignado', None)
        rol = validated_data.pop('rol')
        password = validated_data.pop('password')
        user = User.objects.create_user(password=password, **validated_data)
        perfil, _ = PerfilUsuario.objects.get_or_create(user=user)
        perfil.rol = rol
        perfil.persona_rrhh_id = persona_rrhh_id
        perfil.medico_asignado_id = medico_asignado_id
        perfil.save()
        return perfil


class UsuarioUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    email = serializers.EmailField(required=False)
    rol = serializers.ChoiceField(choices=PerfilUsuario.ROLES, required=False)
    persona_rrhh = serializers.IntegerField(required=False, allow_null=True)
    medico_asignado = serializers.IntegerField(required=False, allow_null=True)

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
        if 'medico_asignado' in validated_data:
            instance.medico_asignado_id = validated_data['medico_asignado']
        instance.save()
        return instance
