import { Menu } from 'lucide-react'

export default function Navbar({ onMenuToggle, collapsed }) {
  return (
    <header
      className={
        collapsed
          ? 'fixed top-0 right-0 left-16 h-16 bg-white border-b border-gray-200 flex items-center px-4 z-40 transition-all duration-300'
          : 'fixed top-0 right-0 left-64 h-16 bg-white border-b border-gray-200 flex items-center px-4 z-40 transition-all duration-300'
      }
    >
      {/* Botón mobile */}
      <button
        onClick={onMenuToggle}
        className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 md:hidden"
      >
        <Menu size={20} />
      </button>
    </header>
  )
}