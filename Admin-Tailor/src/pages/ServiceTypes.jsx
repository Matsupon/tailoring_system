import React, { useState, useEffect } from 'react';
import api from '../api';
import '../styles/Dashboard.css';

const ServiceTypes = () => {
  const [serviceTypes, setServiceTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [newService, setNewService] = useState({ name: '', downpayment: '' });
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  const fetchServiceTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/service-types');
      setServiceTypes(response.data.data || []);
      setError('');
    } catch (err) {
      setError('Failed to fetch service types');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    if (!newService.name.trim() || !newService.downpayment) {
      setError('Please fill in all fields');
      return;
    }

    try {
      await api.post('/service-types', {
        name: newService.name.trim(),
        downpayment_amount: parseFloat(newService.downpayment)
      });
      
      setSuccess('Service type added successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setShowAddModal(false);
      setNewService({ name: '', downpayment: '' });
      fetchServiceTypes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add service type');
    }
  };

  const handleEditService = async () => {
    if (!editingService.downpayment_amount) {
      setError('Please enter a valid downpayment amount');
      return;
    }

    try {
      await api.put(`/service-types/${editingService.id}`, {
        downpayment_amount: parseFloat(editingService.downpayment_amount)
      });
      
      setSuccess('Service type updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
      setShowEditModal(false);
      setEditingService(null);
      fetchServiceTypes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update service type');
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service type?')) {
      return;
    }

    try {
      await api.delete(`/service-types/${id}`);
      setSuccess('Service type deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
      fetchServiceTypes();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete service type');
    }
  };

  const openEditModal = (service) => {
    setEditingService({ ...service });
    setShowEditModal(true);
    setError('');
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setEditingService(null);
    setNewService({ name: '', downpayment: '' });
    setError('');
  };

  if (loading) {
    return (
      <div className="page-wrap">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>Loading service types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap" style={{ padding: '20px', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px',
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div>
          <p style={{ margin: '8px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            Manage service types and their downpayment amounts. Changes will be reflected immediately in customer bookings.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: '#10b981',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          + Add New Service Type
        </button>
      </div>

      {/* Success Message */}
      {success && (
        <div style={{
          background: '#dcfce7',
          color: '#166534',
          border: '1px solid #bbf7d0',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '600'
        }}>
          {success}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          background: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontWeight: '600'
        }}>
          {error}
        </div>
      )}

      {/* Service Types Table */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ 
                padding: '16px 20px', 
                textAlign: 'center', 
                fontWeight: '600', 
                color: '#475569',
                fontSize: '14px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                SERVICE TYPE
              </th>
              <th style={{ 
                padding: '16px 20px', 
                textAlign: 'center', 
                fontWeight: '600', 
                color: '#475569',
                fontSize: '14px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                DOWNPAYMENT AMOUNT
              </th>
              <th style={{ 
                padding: '16px 20px', 
                textAlign: 'center', 
                fontWeight: '600', 
                color: '#475569',
                fontSize: '14px',
                borderBottom: '1px solid #e2e8f0'
              }}>
                ACTIONS
              </th>
            </tr>
          </thead>
          <tbody>
            {serviceTypes.length > 0 ? (
              serviceTypes.map((service) => (
                <tr key={service.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '16px 20px', color: '#1e293b', fontSize: '14px', textAlign: 'center' }}>
                    {service.name}
                  </td>
                  <td style={{ padding: '16px 20px', color: '#10b981', fontSize: '14px', fontWeight: '600', textAlign: 'center' }}>
                    ₱{parseFloat(service.downpayment_amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button
                        onClick={() => openEditModal(service)}
                        style={{
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteService(service.id)}
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="3" style={{ 
                  padding: '40px 20px', 
                  textAlign: 'center', 
                  color: '#64748b',
                  fontSize: '14px'
                }}>
                  No service types found. Add your first service type to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Service Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              Add New Service Type
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Service Name
              </label>
              <input
                type="text"
                value={newService.name}
                onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                placeholder="e.g., Custom Tailoring"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Downpayment Amount (₱)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newService.downpayment}
                onChange={(e) => setNewService({ ...newService, downpayment: e.target.value })}
                placeholder="500.00"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModals}
                style={{
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddService}
                style={{
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {showEditModal && editingService && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '12px',
            width: '400px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
              Edit Service Type
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Service Name
              </label>
              <input
                type="text"
                value={editingService.name}
                disabled
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  background: '#f9fafb',
                  color: '#6b7280'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: '500', fontSize: '14px' }}>
                Downpayment Amount (₱)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editingService.downpayment_amount}
                onChange={(e) => setEditingService({ ...editingService, downpayment_amount: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={closeModals}
                style={{
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleEditService}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  padding: '10px 16px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Update Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceTypes;