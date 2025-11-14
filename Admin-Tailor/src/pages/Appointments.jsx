import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import '../styles/Appointments.css';
import '../styles/Feedback.css';
import { FaTrashAlt } from 'react-icons/fa';
import { AiOutlineClose } from 'react-icons/ai';
import api from '../api';

const Appointments = () => {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false); // Start with false - only show loading if request is slow
  const [error, setError] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsClosing, setDetailsClosing] = useState(false);
  const [queueSuccess, setQueueSuccess] = useState(false);
  const [queueConfirmId, setQueueConfirmId] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [unviewedAppointmentIds, setUnviewedAppointmentIds] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectAppointmentId, setRejectAppointmentId] = useState(null);
  const [refundImage, setRefundImage] = useState(null);
  const [refundImagePreview, setRefundImagePreview] = useState(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectSuccess, setRejectSuccess] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAppointmentId, setRefundAppointmentId] = useState(null);
  const [refundImageFile, setRefundImageFile] = useState(null);
  const [refundImagePreviewFile, setRefundImagePreviewFile] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/login');
    }
  }, [navigate]);

  useEffect(() => {
    // Create abort controller for request cancellation
    const abortController = new AbortController();
    const { signal } = abortController;
    
    // Optimistic UI - only show loading if request takes longer than 150ms
    const showLoadingTimeout = setTimeout(() => {
      setIsLoading(true);
    }, 150);

    const fetchAppointments = async () => {
      try {
        const token = localStorage.getItem('adminToken');
        if (!token) {
          clearTimeout(showLoadingTimeout);
          setError('No admin token found');
          setIsLoading(false);
          return;
        }

        let response;
        try {
          response = await api.get('/admin/appointments', { signal });
          
          if (signal.aborted) return;
          
          if (response.data.success && response.data.data) {
            setAppointments(response.data.data);
          } else if (Array.isArray(response.data)) {
            setAppointments(response.data);
          } else {
            throw new Error('Invalid response format from server');
          }
          
          clearTimeout(showLoadingTimeout);
          setIsLoading(false);
          setError(null);
          return;
        } catch (adminError) {
          if (signal.aborted || adminError.name === 'CanceledError' || adminError.name === 'AbortError') return;
          
          try {
            response = await api.get('/appointments', { signal });
            
            if (signal.aborted) return;
            
            if (Array.isArray(response.data)) {
              setAppointments(response.data);
              clearTimeout(showLoadingTimeout);
              setIsLoading(false);
              setError(null);
              return;
            } else {
              throw new Error('Invalid response format from original endpoint');
            }
          } catch (originalError) {
            if (signal.aborted || originalError.name === 'CanceledError' || originalError.name === 'AbortError') return;
            clearTimeout(showLoadingTimeout);
            setError(originalError.response?.data?.message || 'Failed to fetch appointments');
            setIsLoading(false);
          }
        }
        
      } catch (err) {
        if (signal.aborted || err.name === 'CanceledError' || err.name === 'AbortError') return;
        clearTimeout(showLoadingTimeout);
        setError(err.response?.data?.message || err.message || 'Failed to fetch appointments');
        setIsLoading(false);
      }
    };

    const fetchViewStates = async () => {
      try {
        const res = await api.get('/notifications/appointments/view-states', { signal });
        if (signal.aborted) return;
        if (res.data?.success) {
          const items = res.data.data || [];
          const unviewed = new Set(items.filter(i => !i.is_viewed).map(i => i.appointment_id));
          setUnviewedAppointmentIds(unviewed);
        }
      } catch (err) {
        if (signal.aborted || err.name === 'CanceledError' || err.name === 'AbortError') return;
        // Silently fail for view states - not critical
      }
    };

    // Fetch both in parallel for faster loading
    Promise.all([
      fetchAppointments(),
      fetchViewStates()
    ]).catch(() => {
      // Errors handled individually
    });
    
    // Refresh appointments every 30 seconds to reflect cancellations
    const refreshInterval = setInterval(() => {
      if (!signal.aborted) {
        fetchAppointments();
        fetchViewStates();
      }
    }, 30000);
    
    return () => {
      clearTimeout(showLoadingTimeout);
      clearInterval(refreshInterval);
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    
    const [hours, minutes] = timeString.split(':');
    const hourInt = parseInt(hours, 10);
    const period = hourInt >= 12 ? 'PM' : 'AM';
    const formattedHour = hourInt % 12 || 12;
    
    return `${formattedHour}:${minutes} ${period}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const monthNames = ["January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"];
    
    const date = new Date(dateString);
    return `${monthNames[date.getMonth()]} ${date.getDate()}`;
  };

  const formatDateTime = (dateString, timeString) => {
    if (!dateString) return 'N/A';
    
    const monthNames = ["January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"];
    
    const date = new Date(dateString);
    const month = monthNames[date.getMonth()];
    const day = date.getDate();
    const time = formatTime(timeString);
    
    return `${month} ${day} - ${time}`;
  };

  const handleViewDetails = async (appointment) => {
    setSelectedAppointment(appointment);
    setShowDetails(true);
    
    // Only update if appointment is unviewed
    if (!unviewedAppointmentIds.has(appointment.id)) {
      return;
    }
    
    // Optimistically update UI immediately for better UX
    setUnviewedAppointmentIds(prev => {
      if (!prev.has(appointment.id)) return prev;
      const next = new Set(prev);
      next.delete(appointment.id);
      return next;
    });
    
    // Update database - mark appointment as viewed (triggers viewed_at column)
    try {
      await api.patch(`/notifications/appointments/${appointment.id}/viewed`);
      
      // Refresh view states to ensure consistency with database
      const res = await api.get('/notifications/appointments/view-states');
      if (res.data?.success) {
        const items = res.data.data || [];
        const unviewed = new Set(items.filter(i => !i.is_viewed).map(i => i.appointment_id));
        setUnviewedAppointmentIds(unviewed);
      }
    } catch (err) {
      // Revert optimistic update on error
      setUnviewedAppointmentIds(prev => {
        const next = new Set(prev);
        next.add(appointment.id);
        return next;
      });
    }
  };

  const handleImageClick = (imageSrc, imageAlt) => {
    setSelectedImage({ src: imageSrc, alt: imageAlt });
    setShowImageModal(true);
  };

  // Close modals when ESC key is pressed
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' || event.keyCode === 27) {
        if (showDetails) {
          setDetailsClosing(true);
          setTimeout(() => {
            setShowDetails(false);
            setDetailsClosing(false);
          }, 200);
        } else if (showImageModal) {
          setShowImageModal(false);
          setSelectedImage(null);
        } else if (showRejectModal) {
          setShowRejectModal(false);
          setRejectAppointmentId(null);
          setRefundImage(null);
          setRefundImagePreview(null);
        } else if (showRefundModal) {
          setShowRefundModal(false);
          setRefundAppointmentId(null);
          setRefundImageFile(null);
          setRefundImagePreviewFile(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showDetails, showImageModal, showRejectModal, showRefundModal]);

  const handleAddToQueue = (id) => {
    setQueueConfirmId(id);
  };

  const confirmAddToQueue = async () => {
    try {
      await api.post(`/orders/${queueConfirmId}`);
      setAppointments(appointments.filter(a => a.id !== queueConfirmId));
      setQueueConfirmId(null);
      setQueueSuccess(true);
      setTimeout(() => setQueueSuccess(false), 5000);
    } catch (err) {
      setQueueConfirmId(null);
      setError("Failed to add appointment to queue. Please try again.");
    }
  };


  const handleRemove = (id) => {
    setRejectAppointmentId(id);
    setShowRejectModal(true);
  };

  const handleRefundImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRefundImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefundImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRejectAppointment = async () => {
    if (!refundImage) {
      alert('Please upload a GCash refund image before rejecting this appointment.');
      return;
    }

    try {
      setRejecting(true);
      const formData = new FormData();
      formData.append('refund_image', refundImage);

      // Don't manually set Content-Type - let axios set it with proper boundary
      await api.post(`/admin/appointments/${rejectAppointmentId}/reject`, formData);

      setAppointments(appointments.filter(a => a.id !== rejectAppointmentId));
      setShowRejectModal(false);
      setRejectAppointmentId(null);
      setRefundImage(null);
      setRefundImagePreview(null);
      setRejectSuccess(true);
      setTimeout(() => setRejectSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reject appointment. Please try again.');
    } finally {
      setRejecting(false);
    }
  };

  const handleRefundAppointment = (id) => {
    setRefundAppointmentId(id);
    setShowRefundModal(true);
  };

  const handleRefundImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRefundImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefundImagePreviewFile(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessRefund = async () => {
    if (!refundImageFile) {
      alert('Please upload a GCash refund image before processing the refund.');
      return;
    }

    try {
      setRefunding(true);
      const formData = new FormData();
      formData.append('refund_image', refundImageFile);

      // Don't manually set Content-Type - let axios set it with proper boundary
      await api.post(`/admin/appointments/${refundAppointmentId}/refund`, formData);

      // Remove appointment from list after refund is processed
      setAppointments(appointments.filter(a => a.id !== refundAppointmentId));
      setShowRefundModal(false);
      setRefundAppointmentId(null);
      setRefundImageFile(null);
      setRefundImagePreviewFile(null);
      setRefundSuccess(true);
      setTimeout(() => setRefundSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process refund. Please try again.');
    } finally {
      setRefunding(false);
    }
  };

  // Pagination calculations - memoized for performance
  const { totalPages, currentAppointments } = useMemo(() => {
    const total = Math.ceil(appointments.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const current = appointments.slice(start, end);
    return { totalPages: total, currentAppointments: current };
  }, [appointments, currentPage, itemsPerPage]);

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

  return (
    <>
      <div className="appointments-content" style={{ marginTop: 8 }}>
          <div
            className="feedback-card-container"
            style={{
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              marginBottom: 10,
              overflow: 'hidden',
              padding: '24px 24px 8px 24px',
              margin: '0 16px 10px 16px'
            }}
          >
            {isLoading ? (
              <p>Loading appointments...</p>
            ) : error ? (
              <p>Error: {error}</p>
            ) : appointments.length === 0 ? (
              <p>No appointments found.</p>
            ) : (
              <div className="table-scroll-container with-pagination">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
  <thead>
    <tr style={{ background: '#e8f4fd' }}>
      <th>Date & Time</th>
      <th>Name</th>
      <th>Service</th>
      <th>Action</th>
      <th>State</th>
      <th>Add to Queue</th>
      <th>Reject</th>
    </tr>
  </thead>
  <tbody>
    {currentAppointments.map((appt) => {
      const isCancelled = appt.state === 'cancelled';
      const isUnviewed = unviewedAppointmentIds.has(appt.id);
      return (
        <tr 
          key={appt.id} 
          className={isUnviewed ? 'unviewed-appointment' : ''}
          style={isUnviewed ? { background: '#e6f0ff' } : {}}
        >
          <td>{formatDateTime(appt.appointment_date, appt.appointment_time)}</td>
          <td>{appt.user?.name || 'N/A'}</td>
          <td>{appt.service_type}</td>
          <td>
            <span
              className="action-link"
              onClick={() => handleViewDetails(appt)}
              style={{ cursor: 'pointer' }}
            >
              View Details
            </span>
          </td>
          <td>
            <span style={{ 
              display: 'inline-block',
              padding: '4px 10px',
              borderRadius: 9999,
              background: appt.state === 'active' ? 'rgba(76, 175, 80, 0.15)' : 'rgba(244, 67, 54, 0.15)',
              color: appt.state === 'active' ? '#2e7d32' : '#c62828',
              fontWeight: 700,
              lineHeight: 1
            }}>
              {appt.state === 'active' ? 'Active' : 'Cancelled'}
            </span>
          </td>
          {isCancelled ? (
            <>
              <td colSpan="2" style={{ textAlign: 'center' }}>
                <button
                  onClick={() => handleRefundAppointment(appt.id)}
                  style={{
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Refund
                </button>
              </td>
            </>
          ) : (
            <>
              <td>
                <input 
                  type="checkbox" 
                  onChange={() => handleAddToQueue(appt.id)}
                  checked={queueConfirmId === appt.id}
                />
              </td>
              <td>
                <FaTrashAlt className="delete-icon" onClick={() => handleRemove(appt.id)} style={{ color: '#ef4444', cursor: 'pointer' }} />
              </td>
            </>
          )}
        </tr>
      );
    })}
  </tbody>
              </table>
              </div>
            )}
          </div>

          {/* Pagination Panel - Fixed at bottom */}
          {!isLoading && !error && appointments.length > 0 && (
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
                  Showing {currentAppointments.length} of {appointments.length} results
                </span>
              </div>
            </div>
          )}

          {/* View Details Modal (Dashboard style) */}
          {showDetails && selectedAppointment && createPortal(
            (
              <div
                className={`dashboard-modal-bg animate-fade${detailsClosing ? ' closing' : ''}`}
                onClick={() => {
                  setDetailsClosing(true);
                  setTimeout(() => {
                    setShowDetails(false);
                    setDetailsClosing(false);
                  }, 200);
                }}
              >
                <div
                  className={`dashboard-modal-panel animate-pop${detailsClosing ? ' closing' : ''}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <AiOutlineClose
                    className="dashboard-modal-exit-icon"
                    onClick={() => {
                      setDetailsClosing(true);
                      setTimeout(() => {
                        setShowDetails(false);
                        setDetailsClosing(false);
                      }, 200);
                    }}
                  />
                  <h2 className="dashboard-modal-title">Appointment Details</h2>
                  <div className="dashboard-details-container" style={{ flexWrap: 'wrap' }}>
                    <div className="dashboard-details-left">
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Full Name</div>
                        <div className="dashboard-detail-value">{selectedAppointment.user?.name || 'N/A'}</div>
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Appointment Date</div>
                        <div className="dashboard-detail-value">{selectedAppointment.appointment_date ? new Date(selectedAppointment.appointment_date).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Service Type</div>
                        <div className="dashboard-detail-value">{selectedAppointment.service_type || 'N/A'}</div>
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Phone Number</div>
                        <div className="dashboard-detail-value">{selectedAppointment.user?.phone || selectedAppointment.user?.phone_number || 'N/A'}</div>
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Size</div>
                        <div className="dashboard-detail-value">
                          {(() => {
                            const rawSizes = selectedAppointment.sizes;
                            if (!rawSizes) return 'N/A';
                            try {
                              const parsed = typeof rawSizes === 'string' ? JSON.parse(rawSizes) : rawSizes;
                              if (parsed && typeof parsed === 'object') {
                                return (
                                  <>
                                    {Object.entries(parsed).map(([size, qty]) => (
                                      <div key={size}>{size} - {qty} pcs.</div>
                                    ))}
                                  </>
                                );
                              }
                              return String(rawSizes);
                            } catch (_) {
                              return String(rawSizes);
                            }
                          })()}
                        </div>
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Quantity</div>
                        <div className="dashboard-detail-value">{selectedAppointment.total_quantity ? `${selectedAppointment.total_quantity} pcs.` : 'N/A'}</div>
                      </div>
                    </div>
                    <div className="dashboard-details-right">
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Due Date</div>
                        <div className="dashboard-detail-value">{selectedAppointment.preferred_due_date ? new Date(selectedAppointment.preferred_due_date).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-detail-label">Notes</div>
                        <div className="dashboard-detail-value">{selectedAppointment.notes || 'No notes provided.'}</div>
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-image-label">Design Image</div>
                        {selectedAppointment.design_image ? (
                          <img 
                            src={selectedAppointment.design_image} 
                            alt="Design" 
                            className="dashboard-modal-image"
                            onClick={() => handleImageClick(selectedAppointment.design_image, 'Design Image')}
                          />
                        ) : (
                          <div style={{ padding: '20px', border: '1px solid #ddd', textAlign: 'center', marginTop: 8 }}>
                            No design image uploaded
                          </div>
                        )}
                      </div>
                      <div className="dashboard-detail-group">
                        <div className="dashboard-image-label">GCash Proof</div>
                        {selectedAppointment.gcash_proof ? (
                          <img 
                            src={selectedAppointment.gcash_proof} 
                            alt="GCash Payment" 
                            className="dashboard-modal-image"
                            onClick={() => handleImageClick(selectedAppointment.gcash_proof, 'GCash Payment Proof')}
                          />
                        ) : (
                          <div style={{ padding: '20px', border: '1px solid #ddd', textAlign: 'center', marginTop: 8 }}>
                            No GCash proof uploaded
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Queue Confirmation Modal */}
          {queueConfirmId !== null && createPortal(
            (
              <div className="dashboard-modal-bg animate-fade" onClick={() => setQueueConfirmId(null)}>
                <div className="dashboard-modal-panel animate-pop" style={{ maxWidth: 400, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                  <h3 style={{ marginBottom: 20, textAlign: 'center' }}>Add this appointment to the queue?</h3>
                  <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                    <button
                      className="modal-button"
                      style={{ flex: 1, fontSize: 16, background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                      onClick={() => setQueueConfirmId(null)}
                    >
                      No
                    </button>
                    <button
                      className="modal-button"
                      style={{ flex: 1, fontSize: 16, background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                      onClick={confirmAddToQueue}
                    >
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Add to Queue Success Popup */}
          {queueSuccess && (
            <div className="popup-queue-success">
              <h3>User appointment successfully accepted!</h3>
              <div>View appointment details at the Orders Page</div>
            </div>
          )}

          {/* Reject Appointment Modal with Refund Image Upload */}
          {showRejectModal && createPortal(
            (
              <div className="dashboard-modal-bg animate-fade" onClick={() => {
                setShowRejectModal(false);
                setRefundImage(null);
                setRefundImagePreview(null);
              }}>
                <div className="dashboard-modal-panel animate-pop" style={{ maxWidth: 500, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
                  <AiOutlineClose
                    className="dashboard-modal-exit-icon"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRefundImage(null);
                      setRefundImagePreview(null);
                    }}
                    style={{ position: 'absolute', top: 16, right: 16, cursor: 'pointer' }}
                  />
                  <h3 style={{ marginBottom: 20, textAlign: 'center', marginTop: 10 }}>Reject Appointment</h3>
                  <p style={{ marginBottom: 20, textAlign: 'center', color: '#666' }}>
                    Please upload a GCash refund image before rejecting this appointment.
                  </p>
                  
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: '600', color: '#333' }}>
                      GCash Refund Image *
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRefundImageChange}
                      style={{ marginBottom: 12, width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
                    />
                    {refundImagePreview && (
                      <div style={{ marginTop: 12 }}>
                        <img
                          src={refundImagePreview}
                          alt="Refund preview"
                          style={{ maxWidth: '100%', maxHeight: 200, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
                          onClick={() => handleImageClick(refundImagePreview, 'Refund Preview')}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                    <button
                      className="modal-button"
                      style={{ flex: 1, fontSize: 16, background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                      onClick={() => {
                        setShowRejectModal(false);
                        setRefundImage(null);
                        setRefundImagePreview(null);
                      }}
                      disabled={rejecting}
                    >
                      Cancel
                    </button>
                    <button
                      className="modal-button"
                      style={{ flex: 1, fontSize: 16, background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: rejecting || !refundImage ? 'not-allowed' : 'pointer', opacity: rejecting || !refundImage ? 0.6 : 1 }}
                      onClick={handleRejectAppointment}
                      disabled={rejecting || !refundImage}
                    >
                      {rejecting ? 'Rejecting...' : 'Reject Order'}
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Reject Success Popup */}
          {rejectSuccess && (
            <div className="popup-delete-success">
              <h3>Appointment Successfully Rejected!</h3>
            </div>
          )}

          {/* Refund Modal */}
          {showRefundModal && createPortal(
            (
              <div className="dashboard-modal-bg animate-fade" onClick={() => {
                setShowRefundModal(false);
                setRefundImageFile(null);
                setRefundImagePreviewFile(null);
              }}>
                <div className="dashboard-modal-panel animate-pop" style={{ maxWidth: 500, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
                  <AiOutlineClose
                    className="dashboard-modal-exit-icon"
                    onClick={() => {
                      setShowRefundModal(false);
                      setRefundImageFile(null);
                      setRefundImagePreviewFile(null);
                    }}
                    style={{ position: 'absolute', top: 16, right: 16, cursor: 'pointer' }}
                  />
                  <h3 style={{ marginBottom: 20, textAlign: 'center', marginTop: 10 }}>Process Refund</h3>
                  <p style={{ marginBottom: 20, textAlign: 'center', color: '#666' }}>
                    Please upload a GCash refund image to process the refund for this cancelled appointment.
                  </p>
                  
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontWeight: '600', color: '#333' }}>
                      GCash Refund Image *
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleRefundImageFileChange}
                      style={{ marginBottom: 12, width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
                    />
                    {refundImagePreviewFile && (
                      <div style={{ marginTop: 12 }}>
                        <img
                          src={refundImagePreviewFile}
                          alt="Refund preview"
                          style={{ maxWidth: '100%', maxHeight: 200, border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
                          onClick={() => handleImageClick(refundImagePreviewFile, 'Refund Preview')}
                        />
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                    <button
                      className="modal-button"
                      style={{ flex: 1, fontSize: 16, background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                      onClick={() => {
                        setShowRefundModal(false);
                        setRefundImageFile(null);
                        setRefundImagePreviewFile(null);
                      }}
                      disabled={refunding}
                    >
                      Cancel
                    </button>
                    <button
                      className="modal-button"
                      style={{ flex: 1, fontSize: 16, background: '#f44336', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: refunding || !refundImageFile ? 'not-allowed' : 'pointer', opacity: refunding || !refundImageFile ? 0.6 : 1 }}
                      onClick={handleProcessRefund}
                      disabled={refunding || !refundImageFile}
                    >
                      {refunding ? 'Processing...' : 'Process Refund'}
                    </button>
                  </div>
                </div>
              </div>
            ),
            document.body
          )}

          {/* Refund Success Popup */}
          {refundSuccess && (
            <div className="popup-delete-success">
              <h3>Refund Processed Successfully!</h3>
            </div>
          )}

          {/* Image Modal for Zoom */}
          {showImageModal && selectedImage && createPortal(
            (
              <div className="dashboard-modal-bg animate-fade" onClick={() => setShowImageModal(false)}>
                <div className="dashboard-modal-panel animate-pop" onClick={(e) => e.stopPropagation()} style={{ padding: 12 }}>
                  <AiOutlineClose className="dashboard-modal-exit-icon" onClick={() => setShowImageModal(false)} />
                  <img
                    src={selectedImage.src}
                    alt={selectedImage.alt}
                    style={{ maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 6, border: '1px solid #ddd' }}
                  />
                </div>
              </div>
            ),
            document.body
          )}
      </div>
    </>
  );
};

export default Appointments;