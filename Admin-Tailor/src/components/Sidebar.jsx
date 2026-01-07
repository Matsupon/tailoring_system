import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaTachometerAlt, FaCalendarAlt, FaShoppingBag, FaUsers, FaBars } from 'react-icons/fa';
import { FaCog } from 'react-icons/fa';
import { FaStar } from 'react-icons/fa';
import '../styles/Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminData');
    navigate('/login');
  };

  const menuItems = [
    { path: '/dashboard', name: 'Dashboard', icon: FaTachometerAlt },
    { path: '/appointments', name: 'Appointments', icon: FaCalendarAlt },
    { path: '/orders', name: 'Orders', icon: FaShoppingBag },
    { path: '/orders-history', name: "Order History", icon: FaShoppingBag },
    { path: '/service-types', name: 'Service Types', icon: FaCog },
    { path: '/customers', name: 'Customers', icon: FaUsers },
    { path: '/feedback', name: 'Feedback', icon: FaStar },
  ];

  return (
    <>
      {isMobile && (
        <button className="mobile-menu-toggle" onClick={toggleSidebar}>
          <FaBars />
        </button>
      )}
      
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <img src="/logo.png" alt="Jun Tailoring Logo" className="logo-image" />
            <h2>Jun Tailoring</h2>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={closeSidebar}
              >
                <Icon className="nav-icon" />
                <span className="nav-text">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div style={{ marginTop: 'auto', padding: '12px' }}>
          <Link
            to="/profile"
            onClick={closeSidebar}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              textDecoration: 'none',
              background: '#ffffff',
              border: '1px solid rgba(59,130,246,0.2)',
              color: '#1e293b',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '12px 16px',
              textAlign: 'center',
              borderRadius: '8px',
              fontSize: '16px',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.10)',
              transition: 'all 0.3s ease',
              marginBottom: '10px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(59,130,246,0.2)';
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
              e.currentTarget.style.color = '#3b82f6';
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.10)';
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.color = '#1e293b';
              e.currentTarget.style.borderColor = 'rgba(59,130,246,0.2)';
            }}
          >
            <FaCog />
            <span>Settings</span>
          </Link>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
              border: 'none',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              padding: '12px 16px',
              textAlign: 'center',
              borderRadius: '8px',
              fontSize: '16px',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.4)';
              e.target.style.background = 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
              e.target.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
            }}
          >
            <span></span>
            LOGOUT
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;