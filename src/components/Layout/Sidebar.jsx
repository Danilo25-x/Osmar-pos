import { NavLink, useNavigate } from 'react-router-dom'
import { Home, ShoppingBag, Shirt, BarChart3, Settings, LogOut, Users, WalletCards } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import ThemeToggle from '../UI/ThemeToggle'
import logo from '../../assets/logo-osmar.png'

const NAV = [
  { to: '/',          icon: Home,        label: 'Inicio',        perm: 'dashboard' },
  { to: '/ventas',    icon: ShoppingBag, label: 'Ventas',        perm: 'sales' },
  { to: '/inventory', icon: Shirt,       label: 'Inventario',    perm: 'inventory' },
  { to: '/customers', icon: Users,       label: 'Clientes',      perm: 'customers' },
  { to: '/cash',      icon: WalletCards, label: 'Caja',          perm: 'cash_register' },
  { to: '/reports',   icon: BarChart3,   label: 'Reportes',      perm: 'reports' },
  { to: '/settings',  icon: Settings,    label: 'Configuración', perm: 'settings' },
]

export default function Sidebar() {
  const { user, hasPermission, logout } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = async () => { await logout(); navigate('/login') }

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img className="sidebar__logo" src={logo} alt="Osmar Fashion and Style" />
        <img className="sidebar__mark" src={logo} alt="" aria-hidden="true" />
      </div>

      <nav className="sidebar__nav" aria-label="Principal">
        {NAV.map(({ to, icon: Icon, label, perm }) => hasPermission(perm) && (
          <NavLink key={to} to={to} end={to === '/'} title={label} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={20} strokeWidth={1.9} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__user">
        <div className="avatar">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
        <div className="sidebar__uinfo">
          <div className="sidebar__uname">{user?.name || 'Usuario'}</div>
          <div className="sidebar__role">{user?.role || 'empleado'}</div>
        </div>
        <ThemeToggle className="sidebar__theme" />
        <button type="button" className="icon-btn sidebar__logout" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}
