import React, { useState, useEffect } from 'react';
import { FaUser, FaBell } from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AiOutlineClose } from 'react-icons/ai';
import api from '../api';
import { getImageUrl, handleImageError, debugImageUrl } from '../utils/imageUtils';
import '../styles/Header.css';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [unviewedCount, setUnviewedCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  
  const adminData = JSON.parse(localStorage.getItem('adminData') || '{}');
  const adminToken = localStorage.getItem('adminToken');

  useEffect(() => {
    // Preload admin profile as soon as app starts
    const preloadProfile = async () => {
      if (!adminToken) return;
      try {
        const res = await api.get('/admin/profile');
        if (res?.data?.admin) {
          localStorage.setItem('adminData', JSON.stringify(res.data.admin));
        }
      } catch (_) {
        // silently ignore
      }
    };
    preloadProfile();

    if (!adminToken) {
      navigate('/login');
      return;
    }

    const fetchNotifications = async () => {
      try {
        const [notificationsRes, countRes] = await Promise.all([
          api.get('/admin/notifications'),
          api.get('/admin/notifications/unviewed-count')
        ]);
        
        if (notificationsRes.data?.success) {
          setAdminNotifications(notificationsRes.data.data || []);
        }
        if (countRes.data?.success) {
          setUnviewedCount(countRes.data.data?.unviewed_count || 0);
        }
      } catch (e) {
        // Error fetching admin notifications
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [adminToken, navigate]);

  const handleNotificationClick = async (notification) => {
    setSelectedNotification(notification);
    setShowNotificationModal(true);
    
    if (!notification.is_viewed) {
      try {
        await api.patch(`/admin/notifications/${notification.id}/viewed`);
        setAdminNotifications(prev => prev.map(n => 
          n.id === notification.id ? { ...n, is_viewed: true } : n
        ));
        setUnviewedCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        // Error marking notification as viewed
      }
    }
  };

  if (!adminToken) {
    return null;
  }

  // Sync title with sidebar title items
  const titleItems = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/appointments', name: 'Appointments' },
    { path: '/orders', name: 'Orders' },
    { path: '/orders-history', name: 'Order History' },
    { path: '/service-types', name: 'Service Types' },
    { path: '/customers', name: 'Customers' },
    { path: '/feedback', name: 'Feedback' },
    { path: '/profile', name: 'Profile' },
  ];
  
  const activeTitleItem = titleItems.find(item => location.pathname === item.path);
  const currentTitle = activeTitleItem ? activeTitleItem.name.toUpperCase() : 'ADMIN';

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1 className="header-title">
            {currentTitle}
          </h1>
        </div>
        <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (showNotifications) {
                  setShowAllNotifications(false);
                }
              }}
              className="notification-bell-button"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(59,130,246,0.2)',
                cursor: 'pointer',
                position: 'relative',
                padding: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.3s ease',
                borderRadius: '9999px',
                boxShadow: '0 4px 12px rgba(59,130,246,0.08)',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.outline = 'none'}
              onBlur={(e) => e.target.style.outline = 'none'}
            >
              <FaBell size={18} color="#3b82f6" />
              {unviewedCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: '#e11d48',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                }}>
                  {unviewedCount > 9 ? '9+' : unviewedCount}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '50%',
                transform: 'translateX(50%)',
                marginTop: '8px',
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                minWidth: '300px',
                maxWidth: '400px',
                maxHeight: showAllNotifications ? '400px' : 'auto',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1100,
              }}>
                {adminNotifications.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#687076' }}>
                    No notifications
                  </div>
                ) : (
                  <>
                    <div style={{
                      overflowY: showAllNotifications ? 'auto' : 'visible',
                      maxHeight: showAllNotifications ? '100%' : 'none',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#cbd5e1 #f1f5f9',
                    }}
                    className="notifications-scroll-container"
                    >
                      {(showAllNotifications ? adminNotifications : adminNotifications.slice(0, 3)).map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          style={{
                            padding: '16px',
                            borderBottom: '1px solid #f0f0f0',
                            cursor: 'pointer',
                            background: !notif.is_viewed ? '#e6f0ff' : 'white',
                          }}
                        >
                          <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                            {notif.title}
                          </div>
                          <div style={{ fontSize: '12px', color: '#687076' }}>
                            {new Date(notif.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!showAllNotifications && adminNotifications.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAllNotifications(true);
                        }}
                        style={{
                          width: '100%',
                          padding: '12px',
                          background: '#f8f9fa',
                          border: 'none',
                          borderTop: '1px solid #f0f0f0',
                          cursor: 'pointer',
                          color: '#4682B4',
                          fontWeight: '600',
                          fontSize: '14px',
                          borderRadius: '0 0 8px 8px',
                          transition: 'background 0.2s ease',
                        }}
                        onMouseEnter={(e) => e.target.style.background = '#e9ecef'}
                        onMouseLeave={(e) => e.target.style.background = '#f8f9fa'}
                      >
                        See all notifications
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          
          <Link to="/profile" className="profile-link" style={{ outline: 'none' }}>
          <div className="profile-picture" style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', border: '1px solid #e5e7eb', outline: 'none' }}>
            {adminData?.profile_image_url ? (
              <img 
                src={(() => {
                  const url = getImageUrl(adminData.profile_image_url);
                  debugImageUrl(adminData.profile_image_url, url);
                  return url;
                })()} 
                alt="Admin" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                onError={handleImageError}
              />
            ) : (
              <FaUser />
            )}
          </div>
          </Link>
          <span className="user-role" style={{
            background: '#ffffff',
            border: '1px solid rgba(59,130,246,0.2)',
            padding: '6px 10px',
            borderRadius: 9999,
            boxShadow: '0 4px 12px rgba(59,130,246,0.08)'
          }}>{adminData.fullname || 'Administrator'}</span>
        </div>
      </div>

      {/* Notification Detail Modal */}
      {showNotificationModal && selectedNotification && (
        <div
          className="dashboard-modal-bg animate-fade"
          onClick={() => setShowNotificationModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(128, 128, 128, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 9999999,
          }}
        >
          <div
            className="dashboard-modal-panel animate-pop"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              width: '100%',
              maxWidth: '600px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              position: 'relative',
              textAlign: 'left',
              maxHeight: '85vh',
              overflowY: 'auto',
            }}
          >
            <AiOutlineClose
              className="dashboard-modal-exit-icon"
              onClick={() => setShowNotificationModal(false)}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                cursor: 'pointer',
                fontSize: '24px',
                color: '#666',
                transition: 'color 0.2s ease',
                zIndex: 1,
              }}
              onMouseEnter={(e) => e.target.style.color = '#000'}
              onMouseLeave={(e) => e.target.style.color = '#666'}
            />
            <div style={{ paddingRight: '40px' }}>
              <h2 style={{ 
                marginBottom: '20px', 
                fontSize: '24px', 
                fontWeight: '700',
                color: '#0f172a',
                lineHeight: '1.3',
                paddingTop: '4px',
              }}>
                {selectedNotification.title}
              </h2>
              <div style={{ 
                marginBottom: '16px',
                paddingBottom: '12px',
                borderBottom: '1px solid #e5e7eb',
              }}>
                <span style={{ 
                  fontSize: '13px', 
                  color: '#687076',
                  fontWeight: '500',
                }}>
                  {new Date(selectedNotification.created_at).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p style={{ 
                color: '#334155', 
                lineHeight: '1.7',
                fontSize: '15px',
                marginTop: '16px',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word',
              }}>
                {selectedNotification.body || 'No additional information.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;