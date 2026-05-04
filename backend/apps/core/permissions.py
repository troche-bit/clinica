from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        try:
            return request.user.perfil.rol == 'admin'
        except Exception:
            return False


class IsAdminOrRecepcionista(BasePermission):
    def has_permission(self, request, view):
        try:
            return request.user.perfil.rol in ('admin', 'recepcionista')
        except Exception:
            return False
