import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Users, Calendar, DollarSign,
  ChevronLeft, ChevronRight, LogOut
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { to: '/paciente',   icon: Users,      label: 'Pacientes'  },
  { to: '/citas',       icon: Calendar,   label: 'Citas'      },
  { to: '/pagos',       icon: DollarSign, label: 'Pagos'      },
]

export default function Sidebar({ collapsed, onToggle }) {
  const { logout } = useAuth()

  return (
    <aside
      className={
        collapsed
          ? 'fixed top-0 left-0 h-full bg-white border-r border-gray-200 flex flex-col z-50 w-16 transition-all duration-300'
          : 'fixed top-0 left-0 h-full bg-white border-r border-gray-200 flex flex-col z-50 w-64 transition-all duration-300'
      }
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-gray-200">
        {!collapsed && (
          <span className="text-lg font-bold text-blue-600">Clínica</span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 ml-auto"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Navegación */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg
              transition-colors duration-150 text-sm font-medium
              ${isActive
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-gray-200">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg
            text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut size={18} className="shrink-0" />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  )
}