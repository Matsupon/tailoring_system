import React, { useState, useEffect, useMemo, useCallback } from 'react';
import '../styles/Customers.css';
import '../styles/Orders.css';
import '../styles/Feedback.css';
import { AiOutlineClose } from 'react-icons/ai';
import { FaSearch } from 'react-icons/fa';
import api from '../api';

const getStatusColor = (status) => {
  switch (status) {
    case 'Completed':
      return '#4caf50';
    case 'Finished':
      return '#2196f3';
    case 'Pending':
      return '#FFE082'; // pastel yellow
    case 'Ready to Check':
      return '#FFAB91'; // pastel orange
    case 'No Orders':
      return '#9e9e9e';
    default:
      return '#333';
  }
};

const Customers = () => {
  const [customersData, setCustomersData] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false); // Start with false - only show loading if request is slow
  const [error, setError] = useState(null);
  const [profileModal, setProfileModal] = useState({ open: false, customer: null });
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    // Create abort controller for request cancellation
    const abortController = new AbortController();
    const { signal } = abortController;
    
    // Optimistic UI - only show loading if request takes longer than 150ms
    const showLoadingTimeout = setTimeout(() => {
      setLoading(true);
    }, 150);

    const fetchCustomers = async () => {
      try {
        const response = await api.get('/customers', { signal });
        
        if (signal.aborted) return;
        clearTimeout(showLoadingTimeout);

        if (response.data.success) {
          // Sort customers from newest to oldest (by ID, assuming higher ID = newer)
          const sortedCustomers = [...response.data.data].sort((a, b) => b.id - a.id);
          setCustomersData(sortedCustomers);
          setError(null);
          setLoading(false);
        } else {
          throw new Error(response.data.message || 'Failed to fetch customers');
        }
      } catch (err) {
        if (signal.aborted || err.name === 'CanceledError' || err.name === 'AbortError') return;
        clearTimeout(showLoadingTimeout);
        setError(err.response?.data?.message || err.message || 'Failed to fetch customers');
        setLoading(false);
      }
    };

    fetchCustomers();
    
    return () => {
      clearTimeout(showLoadingTimeout);
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const handleViewProfile = useCallback(async (customer) => {
    try {
      const response = await api.get(`/customers/${customer.id}`);

      if (response.data.success) {
        setProfileModal({ open: true, customer: response.data.data });
        setExpandedOrder(null);
      } else {
        throw new Error(response.data.message || 'Failed to fetch customer profile');
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      alert('Failed to load customer profile');
    }
  }, []);

  const handleCloseModal = () => {
    setProfileModal({ open: false, customer: null });
    setExpandedOrder(null);
  };

  const handleExpandOrder = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const handleImageClick = (imageSrc, imageAlt) => {
    setSelectedImage({ src: imageSrc, alt: imageAlt });
    setShowImageModal(true);
  };

  // Close modals when ESC key is pressed
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        if (profileModal.open) {
          setProfileModal({ open: false, customer: null });
          setExpandedOrder(null);
        } else if (showImageModal) {
          setShowImageModal(false);
          setSelectedImage(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [profileModal.open, showImageModal]);

  // Pagination calculations - memoized for performance
  const { totalPages, currentCustomers, filteredCount } = useMemo(() => {
    // Apply search filter by name (case-insensitive)
    const filtered = customersData.filter((c) =>
      (c.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
    const total = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const current = filtered.slice(start, end);
    return { totalPages: total, currentCustomers: current, filteredCount: filtered.length };
  }, [customersData, currentPage, itemsPerPage, searchQuery]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Scroll to top whenever page changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure scroll happens after DOM update
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, [currentPage]);

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="customers-table-content" style={{ marginTop: 8 }}>
          <div className="customers-table-wrapper">
            <div style={{ textAlign: 'center', padding: '50px' }}>Loading customers...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrap">
        <div className="customers-table-content" style={{ marginTop: 8 }}>
          <div className="customers-table-wrapper">
            <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>Error: {error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
      <div className="customers-table-content" style={{ marginTop: 8 }}>
        {/* Search Bar - OUTSIDE the table container */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 8px 16px 8px', position: 'relative', zIndex: 10 }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
            <FaSearch style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
              fontSize: 14
            }} />
            <input
              type="text"
              placeholder="Search customers by name"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
            />
          </div>
          <div />
        </div>

        <div
          className="feedback-card-container"
          style={{
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16,
            marginBottom: 10,
            overflow: 'hidden',
            padding: '24px 24px 8px 24px',
            margin: '0 8px 10px 8px'
          }}
        >
          <div className={`table-scroll-container ${customersData.length > 0 && totalPages > 1 ? 'with-pagination' : ''}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e8f4fd' }}>
                <th>#</th>
                <th>Name</th>
                <th>Contact Number</th>
                <th>Total Orders</th>
                <th>Last Appoint.</th>
                <th>Last Order Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customersData.length > 0 ? (
                currentCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.id}</td>
                    <td>{customer.name}</td>
                    <td>{customer.contact}</td>
                    <td>{customer.totalOrders}</td>
                    <td>{customer.lastAppointment}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 9999,
                          background: (() => {
                            const s = (customer.lastOrderStatus || '').toLowerCase();
                            if (s === 'completed') return 'rgba(76, 175, 80, 0.15)';
                            if (s === 'finished') return 'rgba(33, 150, 243, 0.15)';
                            if (s === 'pending') return 'rgba(255, 224, 130, 0.5)';
                            if (s === 'ready to check') return 'rgba(255, 171, 145, 0.5)';
                            if (s === 'no orders') return 'rgba(158, 158, 158, 0.15)';
                            return 'rgba(0,0,0,0.06)';
                          })(),
                          color: (() => {
                            const s = (customer.lastOrderStatus || '').toLowerCase();
                            if (s === 'pending') return '#7a5f00'; // darker yellow text
                            if (s === 'ready to check') return '#b23c17'; // darker orange text
                            if (s === 'completed') return '#2e7d32';
                            if (s === 'finished') return '#1565c0';
                            if (s === 'no orders') return '#616161';
                            return '#333';
                          })(),
                          fontWeight: 700,
                          lineHeight: 1,
                        }}
                      >
                        {customer.lastOrderStatus}
                      </span>
                    </td>
                    <td>
                      <span
                        className="action-link"
                        onClick={() => handleViewProfile(customer)}
                        style={{ color: '#007bff', cursor: 'pointer' }}
                      >
                        View Details
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Pagination Panel - Fixed at bottom */}
      {customersData.length > 0 && totalPages > 1 && (
        <div className="pagination-panel">
          <div className="pagination-controls">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next
            </button>
            <span className="pagination-meta" style={{ marginLeft: 12, color: '#475569', fontSize: 13 }}>
              Showing {currentCustomers.length} of {filteredCount} results
            </span>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileModal.open && profileModal.customer && (
        <div className="customers-modal-bg" onClick={handleCloseModal}>
          <div className="customers-modal-panel" onClick={(e) => e.stopPropagation()}>
            <AiOutlineClose className="customers-modal-exit-icon" onClick={handleCloseModal} />
            <h2 className="customers-modal-title">Customer Profile</h2>
            <div className="customers-modal-customer-info">
              <div className="customers-profile-row">
                <div className="customers-profile-col left">
                  <div><b>Name:</b> {profileModal.customer.name}</div>
                  <div><b>Contact:</b> {profileModal.customer.contact}</div>
                </div>
                <div className="customers-profile-col right">
                  <div><b>Total Orders:</b> {profileModal.customer.totalOrders}</div>
                  <div><b>Address:</b> {profileModal.customer.address}</div>
                </div>
              </div>
            </div>

            <div className="customers-modal-orders-list">
              <h3 className="customers-modal-orders-title">Orders History</h3>
              {profileModal.customer.orders?.length > 0 ? (
                profileModal.customer.orders.map((order) => (
                  <div key={order.id} className="customers-modal-order-item">
                    <div
                      className="customers-modal-order-summary"
                      onClick={() => handleExpandOrder(order.id)}
                    >
                      <span>Order #{order.id}</span>
                      <span className="customers-modal-order-status" style={{ color: getStatusColor(order.status) }}>
                        {order.status}
                      </span>
                      <span className={`customers-modal-order-arrow ${expandedOrder === order.id ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </div>

                    {expandedOrder === order.id && (
                      <div className="customers-modal-order-details">
                        <div className="customers-modal-details-left">
                          <div className="customers-modal-detail-label">Appointment Date Accepted</div>
                          <div className="customers-modal-detail-value">{order.appointmentDate}</div>

                          <div className="customers-modal-detail-label">Due Date</div>
                          <div className="customers-modal-detail-value">{order.dueDate || 'N/A'}</div>

                          <div className="customers-modal-detail-label">Service Type</div>
                          <div className="customers-modal-detail-value">{order.service}</div>

                          <div className="customers-modal-detail-label">Size</div>
                          <div className="customers-modal-detail-value">
                            {(() => {
                              const rawSizes = order.sizes;
                              if (!rawSizes) return 'N/A';
                              try {
                                const parsed = typeof rawSizes === 'string' ? JSON.parse(rawSizes) : rawSizes;
                                if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                                  return (
                                    <>
                                      {Object.entries(parsed).map(([size, qty]) => (
                                        <div key={size}>{size} - {qty}</div>
                                      ))}
                                    </>
                                  );
                                }
                                return 'N/A';
                              } catch (_) {
                                return 'N/A';
                              }
                            })()}
                          </div>

                          <div className="customers-modal-detail-label">Quantity</div>
                          <div className="customers-modal-detail-value">
                            {order.total_quantity || (() => {
                              const rawSizes = order.sizes;
                              if (!rawSizes) return 0;
                              try {
                                const parsed = typeof rawSizes === 'string' ? JSON.parse(rawSizes) : rawSizes;
                                if (parsed && typeof parsed === 'object') {
                                  return Object.values(parsed).reduce((a, b) => Number(a) + Number(b), 0);
                                }
                                return 0;
                              } catch (_) {
                                return 0;
                              }
                            })()}
                          </div>
                          <div className="customers-modal-detail-label">Notes</div>
                          <div className="customers-modal-detail-value">{order.notes || 'N/A'}</div>
                        </div>

                        <div className="customers-modal-details-right">
                          {order.designImg && (
                            <>
                              <div className="customers-modal-image-label">Design Image</div>
                              <img
                                src={order.designImg}
                                alt="Design"
                                className="customers-modal-image"
                                onClick={() => handleImageClick(order.designImg, 'Design Image')}
                                style={{ cursor: 'pointer' }}
                              />
                            </>
                          )}

                          {order.gcashImg && (
                            <>
                              <div className="customers-modal-image-label">GCash Proof</div>
                              <img
                                src={order.gcashImg}
                                alt="GCash Proof"
                                className="customers-modal-image"
                                onClick={() => handleImageClick(order.gcashImg, 'GCash Proof')}
                                style={{ cursor: 'pointer' }}
                              />
                            </>
                          )}

                          <div className="customers-modal-detail-label" style={{ marginTop: order.designImg || order.gcashImg ? 12 : 0 }}>Feedback</div>
                          {order.feedback ? (
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                {[1, 2, 3, 4, 5].map((v) => (
                                  <span key={v} style={{ color: v <= (order.feedback.rating || 0) ? '#f5a623' : '#ccc', fontSize: 16, marginRight: 2 }}>★</span>
                                ))}
                              </div>

                              {order.feedback.comment ? (
                                <div className="customers-modal-detail-value">Customer: {order.feedback.comment}</div>
                              ) : (
                                <div className="customers-modal-detail-value" style={{ fontStyle: 'italic' }}>
                                  Customer left no comment.
                                </div>
                              )}

                              <div style={{ marginTop: 6 }}>
                                {order.feedback.admin_response ? (
                                  <div className="customers-modal-detail-value">Admin: {order.feedback.admin_response}</div>
                                ) : order.feedback.admin_checked ? (
                                  <div className="customers-modal-detail-value" style={{ color: '#0f7a28' }}>
                                    Admin checked this feedback.
                                  </div>
                                ) : (
                                  <div className="customers-modal-detail-value" style={{ fontStyle: 'italic' }}>
                                    No admin response yet.
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="customers-modal-detail-value" style={{ fontStyle: 'italic', color: '#999' }}>
                              No feedbacks
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: 10, color: '#777' }}>No previous orders found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Modal for Zoom - ensure above profile modal */}
      {showImageModal && selectedImage && (
        <div className="dashboard-modal-bg animate-fade customers-zoom" onClick={() => setShowImageModal(false)}>
          <div className="dashboard-modal-panel animate-pop" onClick={(e) => e.stopPropagation()} style={{ padding: 12 }}>
            <AiOutlineClose className="dashboard-modal-exit-icon" onClick={() => setShowImageModal(false)} />
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6, border: '1px solid #ddd' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
