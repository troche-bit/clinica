import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Overlay mobile */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        mobileOpen={mobileOpen}
      />

      {/* Navbar */}
      <Navbar
        collapsed={collapsed}
        onMenuToggle={() => setMobileOpen(!mobileOpen)}
      />

      {/* Contenido principal */}
      <main
        className={
          collapsed
            ? 'pt-16 min-h-screen ml-16 transition-all duration-300'
            : 'pt-16 min-h-screen ml-64 transition-all duration-300'
        }
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}