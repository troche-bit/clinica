const { execSync } = require('child_process')
const path = require('path')

const ROOT = path.join(__dirname, '../..')

function crearUsuario(username, password, rol) {
  const script = `
from django.contrib.auth import get_user_model
User = get_user_model()
u, _ = User.objects.get_or_create(username='${username}')
u.set_password('${password}')
u.save()
p = u.perfil
p.rol = '${rol}'
p.activo = True
p.save()
print('${username} listo')
`
  execSync('docker compose exec -T backend python manage.py shell', {
    input: script,
    cwd: ROOT,
    stdio: ['pipe', 'inherit', 'inherit'],
  })
}

async function globalSetup() {
  console.log('\n[setup] Creando usuarios de test en la base de datos...')
  crearUsuario('test_e2e_admin', 'TestAdmin1234!', 'admin')
  crearUsuario('test_e2e_recep', 'TestRecep1234!', 'recepcionista')
  console.log('[setup] Usuarios de test listos.\n')
}

module.exports = globalSetup
