import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { getImageUrl, handleImageError, debugImageUrl } from '../utils/imageUtils';
import '../styles/Dashboard.css';
import '../styles/Profile.css';

const Profile = () => {
  const stored = useMemo(() => {
    try {
      const raw = localStorage.getItem('adminData');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const [form, setForm] = useState({
    fullname: stored?.fullname || '',
    email: stored?.email || '',
    phone: stored?.phone || '',
    address: stored?.address || '',
    password: '',
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [originalForm, setOriginalForm] = useState(null);
  const [profileUrl, setProfileUrl] = useState(stored?.profile_image_url || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoSuccess, setPhotoSuccess] = useState(false);

  useEffect(() => {
    if (stored) {
      setForm((f) => ({ ...f, fullname: stored.fullname || '', email: stored.email || '', phone: stored.phone || '', address: stored.address || '' }));
      if (stored.profile_image_url) {
        setProfileUrl(stored.profile_image_url);
      }
    }
  }, [stored]);

  useEffect(() => {
    let isMounted = true;
    const fetchAdmin = async () => {
      try {
        const res = await api.get('/admin/profile');
        const admin = res?.data?.admin;
        if (admin && isMounted) {
          localStorage.setItem('adminData', JSON.stringify(admin));
          setForm((f) => ({
            ...f,
            fullname: admin.fullname || '',
            email: admin.email || '',
            phone: admin.phone || '',
            address: admin.address || '',
          }));
          setProfileUrl(admin.profile_image_url || null);
        }
      } catch (e) {
        // silently ignore; UI will show stored values if any
      }
    };
    fetchAdmin();
    return () => { isMounted = false; };
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const onEditToggle = async () => {
    if (editing) {
      setSaving(true);
      setError('');
      try {
        const payload = {
          fullname: form.fullname,
          email: form.email,
          phone: form.phone || null,
          address: form.address || null,
        };
        if (form.password && form.password.trim().length > 0) {
          payload.password = form.password;
        }
        const res = await api.patch('/admin/profile', payload);
        const updated = res.data.admin;
        localStorage.setItem('adminData', JSON.stringify(updated));
        setForm((prev) => ({ ...prev, password: '' }));
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
        setEditing(false);
        setOriginalForm(null);
      } catch (err) {
        const msg = err?.response?.data?.message || 'Failed to update profile';
        setError(msg);
      } finally {
        setSaving(false);
      }
    } else {
      // Save current form state before editing
      setOriginalForm({ ...form });
      setEditing(true);
      setError('');
    }
  };

  const handleCancel = () => {
    if (originalForm) {
      setForm(originalForm);
    }
    setEditing(false);
    setError('');
    setOriginalForm(null);
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('photo', file);
      const res = await api.post('/admin/profile/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const updated = res?.data?.admin;
      if (updated) {
        localStorage.setItem('adminData', JSON.stringify(updated));
        setProfileUrl(updated.profile_image_url || null);
        setPhotoSuccess(true);
        setTimeout(() => setPhotoSuccess(false), 3000);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to upload profile picture';
      setError(msg);
    } finally {
      setUploadingPhoto(false);
      // reset the input so same file can be selected again if needed
      e.target.value = '';
    }
  };

  return (
    <div className="page-wrap profile-page" style={{ position: 'relative', padding: '8px 20px 20px 20px'}}>

      {/* Avatar */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          {profileUrl ? (
            <img
              src={(() => {
                const url = getImageUrl(profileUrl);
                debugImageUrl(profileUrl, url);
                return url;
              })()}
              alt="Profile"
              style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb' }}
              onError={handleImageError}
            />
          ) : (
            <div style={{
              width: 120, height: 120, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#f3f4f6', color: '#6b7280', fontWeight: 700, fontSize: 36, border: '2px solid #e5e7eb'
            }}>
              {(form.fullname || 'A').slice(0,1).toUpperCase()}
            </div>
          )}
          <label
            htmlFor="profile_photo_input"
            title="Edit profile picture"
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              transform: 'translate(15%, 15%)',
              background: '#3b82f6',
              color: 'white',
              width: 40,
              height: 40,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid white',
              cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
              fontSize: 18,
              fontWeight: 800
            }}
          >
            {uploadingPhoto ? '…' : '✎'}
          </label>
          <input
            id="profile_photo_input"
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            disabled={uploadingPhoto}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {success && (
        <div style={{
          position: 'fixed',
          top: '30%',
          left: '60%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          color: '#065f46',
          border: '1px solid rgba(16,185,129,0.3)',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(16, 185, 129, 0.25)',
          zIndex: 2000,
          fontWeight: 700,
        }}>
          You have successfully updated your profile!
        </div>
      )}

      {photoSuccess && (
        <div style={{
          position: 'fixed',
          top: '30%',
          left: '60%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          color: '#065f46',
          border: '1px solid rgba(16,185,129,0.3)',
          padding: '16px 24px',
          borderRadius: '8px',
          boxShadow: '0 10px 30px rgba(16, 185, 129, 0.25)',
          zIndex: 2000,
          fontWeight: 700,
        }}>
          You have successfully updated your profile picture!
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '12px',
          background: '#fee2e2',
          color: '#991b1b',
          border: '1px solid #fecaca',
          padding: '10px 12px',
          borderRadius: '6px',
          fontWeight: 600,
        }}>{error}</div>
      )}

      <div style={{
        background: 'white',
        border: '1px solid rgba(59,130,246,0.15)',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 8px 24px rgba(59,130,246,0.08)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Full Name:</label>
            <input name="fullname" value={form.fullname} onChange={handleChange} disabled={!editing}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', background: editing ? 'white' : '#f1f5f9' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Email Address:</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} disabled={!editing}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', background: editing ? 'white' : '#f1f5f9' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Phone Number:</label>
            <input name="phone" value={form.phone} onChange={handleChange} disabled={!editing}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', background: editing ? 'white' : '#f1f5f9' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Address:</label>
            <input name="address" value={form.address} onChange={handleChange} disabled={!editing}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', background: editing ? 'white' : '#f1f5f9' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Password:</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} disabled={!editing}
              placeholder="Leave blank to keep current password (Current password is 'admin123')"
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', background: editing ? 'white' : '#f1f5f9' }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
          {editing && (
            <button onClick={handleCancel} disabled={saving}
              style={{
                background: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                opacity: saving ? 0.6 : 1
              }}>
              Cancel
            </button>
          )}
          <button onClick={onEditToggle} disabled={saving}
            style={{
              background: editing ? '#10b981' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
              opacity: saving ? 0.6 : 1
            }}>
            {editing ? (saving ? 'Saving...' : 'Save') : 'Edit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
