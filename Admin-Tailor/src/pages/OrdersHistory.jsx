import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import '../styles/Orders.css';
import '../styles/Feedback.css';
import '../styles/Dashboard.css';
import { AiOutlineClose } from 'react-icons/ai';
import { FaFilter, FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import api from '../api';
import { getImageUrl, handleImageError } from '../utils/imageUtils';
import * as XLSX from 'xlsx';

const OrdersHistory = () => {
  const [orders, setOrders] = useState([]);
  const filterBtnRef = useRef(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsClosing, setDetailsClosing] = useState(false);
  const [loading, setLoading] = useState(false); // Start with false - only show loading if request is slow
  const [error, setError] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' or 'oldest'
  const [dateFilter, setDateFilter] = useState({ type: 'all', startDate: '', endDate: '' }); // 'all', 'range', or 'specific'
  const [animateStats, setAnimateStats] = useState(false);
  const [displayStats, setDisplayStats] = useState({
    totalFinished: 0,
    thisMonth: 0,
    totalRevenue: 0
  });
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(new Date().getMonth());
  const [datePickerYear, setDatePickerYear] = useState(new Date().getFullYear());
  const [datePickerType, setDatePickerType] = useState('start'); // 'start', 'end', or 'single'
  const [tempSelectedDate, setTempSelectedDate] = useState(null);

  useEffect(() => {
    // Create abort controller for request cancellation
    const abortController = new AbortController();
    const { signal } = abortController;
    
    // Optimistic UI - only show loading if request takes longer than 150ms
    const showLoadingTimeout = setTimeout(() => {
      setLoading(true);
    }, 150);

    const fetchOrders = async () => {
      try {
        const response = await api.get('/orders/history', { signal });
        
        if (signal.aborted) return;
        clearTimeout(showLoadingTimeout);
        
        if (response.data.success) {
          setOrders(response.data.data);
          setError(null);
        } else {
          throw new Error('Failed to fetch order history');
        }
        setLoading(false);
      } catch (err) {
        if (signal.aborted || err.name === 'CanceledError' || err.name === 'AbortError') return;
        clearTimeout(showLoadingTimeout);
        setError(err.response?.data?.error || err.message || 'Error fetching order history');
        setLoading(false);
      }
    };

    fetchOrders();
    
    return () => {
      clearTimeout(showLoadingTimeout);
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Calendar helper variables
  const today = new Date();
  const todayDate = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  
  // Calendar functions
  const handleDatePickerPrevMonth = () => {
    if (datePickerMonth === 0) {
      setDatePickerMonth(11);
      setDatePickerYear(datePickerYear - 1);
    } else {
      setDatePickerMonth(datePickerMonth - 1);
    }
  };

  const handleDatePickerNextMonth = () => {
    if (datePickerMonth === 11) {
      setDatePickerMonth(0);
      setDatePickerYear(datePickerYear + 1);
    } else {
      setDatePickerMonth(datePickerMonth + 1);
    }
  };

  const openDatePicker = (type) => {
    setDatePickerType(type);
    setShowDatePickerModal(true);
    setDatePickerMonth(currentMonth);
    setDatePickerYear(currentYear);
    setTempSelectedDate(null);
    setShowFilterMenu(false); // Close filter dropdown when calendar opens
  };

  const closeDatePicker = () => {
    setShowDatePickerModal(false);
    setTempSelectedDate(null);
  };

  const handleDateSelect = (day) => {
    const selectedDate = `${datePickerYear}-${String(datePickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setTempSelectedDate(selectedDate);
  };

  const confirmDateSelection = () => {
    if (!tempSelectedDate) return;
    
    if (datePickerType === 'single') {
      setDateFilter({ ...dateFilter, startDate: tempSelectedDate });
    } else if (datePickerType === 'start') {
      setDateFilter({ ...dateFilter, startDate: tempSelectedDate });
    } else if (datePickerType === 'end') {
      setDateFilter({ ...dateFilter, endDate: tempSelectedDate });
    }
    
    closeDatePicker();
  };

  const getCalendarDays = () => {
    const daysInMonth = new Date(datePickerYear, datePickerMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(datePickerYear, datePickerMonth, 1).getDay();
    return [
      ...Array(firstDayOfMonth).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
      ...Array((7 - (firstDayOfMonth + daysInMonth) % 7) % 7).fill(null)
    ];
  };

  // Color for order status
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#1565c0';
      case 'finished':
        return '#1565c0';
      case 'pending':
        return '#1565c0'; // darker yellow text
      case 'ongoing':
        return '#1565c0';
      case 'ready to check':
        return '#b23c17'; // darker orange text
      case 'cancelled':
      case 'canceled':
        return '#c62828';
      default:
        return '#333';
    }
  };

  // Format date with AM/PM time
  const formatDateForDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const options = {
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      return date.toLocaleString('en-US', options);
    } catch {
      return dateString;
    }
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
        } else if (showDatePickerModal) {
          closeDatePicker();
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showDetails, showImageModal, showDatePickerModal]);

  // Open modal for order details
  const handleViewFile = (order) => {
    setSelectedOrder(order);
    setShowDetails(true);
  };

  // Image zoom modal
  const handleImageClick = (imageSrc, imageAlt) => {
    setSelectedImage({ src: imageSrc, alt: imageAlt });
    setShowImageModal(true);
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const finishedOrders = orders.filter(o => 
      o.status?.toLowerCase() === 'completed' || o.status?.toLowerCase() === 'finished'
    );
    
    // Total finished orders
    const totalFinished = finishedOrders.length;
    
    // This month's orders
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const thisMonth = finishedOrders.filter(o => {
      if (!o.completed_at) return false;
      const date = new Date(o.completed_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    }).length;
    
    // Total revenue
    const totalRevenue = finishedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
    
    // Top service
    const serviceCounts = {};
    finishedOrders.forEach(o => {
      const service = o.appointment?.service_type || 'N/A';
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
    });
    const topService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    
    return { totalFinished, thisMonth, totalRevenue, topService };
  }, [orders]);

  // Animate stats when they change
  useEffect(() => {
    if (!loading && !error && orders.length > 0) {
      setAnimateStats(false);
      setDisplayStats({ totalFinished: 0, thisMonth: 0, totalRevenue: 0 });
      
      const start = performance.now();
      const dur = 1000;
      
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur);
        setDisplayStats({
          totalFinished: Math.round(stats.totalFinished * p),
          thisMonth: Math.round(stats.thisMonth * p),
          totalRevenue: Math.round(stats.totalRevenue * p)
        });
        
        if (p < 1) {
          requestAnimationFrame(tick);
        } else {
          setAnimateStats(true);
        }
      };
      requestAnimationFrame(tick);
    } else if (!loading && !error && orders.length === 0) {
      setDisplayStats({ totalFinished: 0, thisMonth: 0, totalRevenue: 0 });
    }
  }, [loading, error, orders.length, stats.totalFinished, stats.thisMonth, stats.totalRevenue]);

  // Filter and sort orders
  const filteredAndSortedOrders = useMemo(() => {
    let filtered = [...orders];
    
    // Apply date filter
    if (dateFilter.type === 'specific' && dateFilter.startDate) {
      const targetDate = new Date(dateFilter.startDate);
      filtered = filtered.filter(o => {
        if (!o.completed_at) return false;
        const orderDate = new Date(o.completed_at);
        return orderDate.toDateString() === targetDate.toDateString();
      });
    } else if (dateFilter.type === 'range' && dateFilter.startDate && dateFilter.endDate) {
      const startDate = new Date(dateFilter.startDate);
      const endDate = new Date(dateFilter.endDate);
      filtered = filtered.filter(o => {
        if (!o.completed_at) return false;
        const orderDate = new Date(o.completed_at);
        return orderDate >= startDate && orderDate <= endDate;
      });
    }
    
    // Apply sort order
    filtered.sort((a, b) => {
      const dateA = a.completed_at ? new Date(a.completed_at) : new Date(0);
      const dateB = b.completed_at ? new Date(b.completed_at) : new Date(0);
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return filtered;
  }, [orders, dateFilter, sortOrder]);

  // Pagination calculations - memoized for performance
  const { totalPages, currentOrders } = useMemo(() => {
    const total = Math.ceil(filteredAndSortedOrders.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const current = filteredAndSortedOrders.slice(start, end);
    return { totalPages: total, currentOrders: current };
  }, [filteredAndSortedOrders, currentPage, itemsPerPage]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFilter, sortOrder]);

  // Close filter menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showFilterMenu && !e.target.closest('.filter-dropdown') && !e.target.closest('.filter-btn')) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterMenu]);

  // Get filter display name
  const getFilterDisplayName = () => {
    if (dateFilter.type === 'all' && sortOrder === 'newest') {
      return 'No Filter';
    }
    const parts = [];
    if (sortOrder === 'oldest') {
      parts.push('Oldest to Latest');
    } else {
      parts.push('Latest to Oldest');
    }
    if (dateFilter.type === 'specific') {
      parts.push('Specific Date');
    } else if (dateFilter.type === 'range') {
      parts.push('Date Range');
    }
    return parts.join(' • ');
  };

  // Download reports function
  const handleDownloadReports = () => {
    try {
      // Prepare data for Excel
      const excelData = filteredAndSortedOrders.map((order, index) => ({
        'Order #': order.id,
        'Customer Name': order.appointment?.user?.name || 'N/A',
        'Service Type': order.appointment?.service_type || 'N/A',
        'Status': order.status === 'Completed' ? 'Finished' : (order.status || 'Unknown'),
        'Total Amount': order.total_amount ? `₱${order.total_amount.toLocaleString()}` : 'N/A',
        'Completion Date': order.completed_at ? formatDateForDisplay(order.completed_at) : 'N/A',
        'Appointment Date': order.appointment?.appointment_date ? new Date(order.appointment.appointment_date).toLocaleDateString() : 'N/A',
        'Due Date': order.appointment?.preferred_due_date ? new Date(order.appointment.preferred_due_date).toLocaleDateString() : 'N/A',
        'Quantity': order.appointment?.total_quantity || (() => {
          const rawSizes = order.appointment?.sizes;
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
        })(),
        'Notes': order.appointment?.notes || 'No notes provided'
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 10 }, // Order #
        { wch: 20 }, // Customer Name
        { wch: 25 }, // Service Type
        { wch: 15 }, // Status
        { wch: 15 }, // Total Amount
        { wch: 20 }, // Completion Date
        { wch: 18 }, // Appointment Date
        { wch: 15 }, // Due Date
        { wch: 10 }, // Quantity
        { wch: 30 }  // Notes
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Order History');

      // Generate filename with current date
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `Order_History_Report_${dateStr}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error('Error generating Excel file:', error);
      alert('Failed to generate Excel report. Please try again.');
    }
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

  // Loading state
  if (loading) {
    return (
      <div className="page-wrap">
        <div className="orders-content" style={{ marginTop: 8 }}>
          <p>Loading order history...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="page-wrap">
        <div className="orders-content" style={{ marginTop: 8 }}>
          <p style={{ color: 'red' }}>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap orders-history-page">
      <div className="orders-content orders-history-content" style={{ marginTop: 8 }}>
        {/* Statistics Cards - Dashboard Style */}
        <div className="panel quick-stats" style={{ margin: '0 16px 16px 16px' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="stat-card blue">
              <span className="stat-value">{displayStats.totalFinished}</span>
              <span className="stat-title">Total Finished Orders</span>
            </div>
            <div className="stat-card yellow">
              <span className="stat-value">{displayStats.thisMonth}</span>
              <span className="stat-title">This Month's Orders</span>
            </div>
            <div className="stat-card green">
              <span className="stat-value">₱{displayStats.totalRevenue.toLocaleString()}</span>
              <span className="stat-title">Total Revenue</span>
            </div>
            <div className="stat-card teal">
              <span className="stat-value">{stats.topService}</span>
              <span className="stat-title">Top Service</span>
            </div>
          </div>
        </div>

        {/* Search and Filter Section - OUTSIDE the table container */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 16px 16px 16px', position: 'relative', zIndex: 10 }}>
          {/* Download Reports Button */}
          <button
            onClick={handleDownloadReports}
            style={{
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
          >
            📊 Download Reports
          </button>
          
          {/* Current Filter Display and Filter Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Display current filter */}
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: (dateFilter.type === 'all' && sortOrder === 'newest') ? '#6b7280' : '#2563eb',
              padding: '6px 12px',
              background: (dateFilter.type === 'all' && sortOrder === 'newest') ? '#f3f4f6' : '#dbeafe',
              borderRadius: 6,
              border: (dateFilter.type === 'all' && sortOrder === 'newest') ? '1px solid #e5e7eb' : '1px solid #93c5fd',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}>
              {getFilterDisplayName()}
            </div>
            
            <div style={{ position: 'relative' }}>
              <button
                ref={filterBtnRef}
                className="filter-btn"
                data-filter-btn-history="true"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 16px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: 'background 0.2s',
                  position: 'relative',
                  whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
              >
                <FaFilter /> Filter Orders
              </button>
              
              {/* Filter Dropdown */}
              {showFilterMenu && ReactDOM.createPortal(
                <div 
                  className="filter-dropdown"
                  ref={(el) => {
                    if (el) {
                      const btn = filterBtnRef.current || document.querySelector('button[data-filter-btn-history="true"]');
                      if (btn) {
                        const rect = btn.getBoundingClientRect();
                        const dropdownWidth = el.offsetWidth || 280;
                        
                        // Calculate sidebar width (matches CSS clamp(200px, 20vw, 250px))
                        const sidebarWidth = Math.min(Math.max(200, window.innerWidth * 0.2), 250);
                        const pageMargin = window.innerWidth <= 768 ? 8 : 16;
                        const contentLeft = sidebarWidth;
                        const maxRight = window.innerWidth - pageMargin;
                        const minLeft = contentLeft + pageMargin;
                        
                        // Position aligned to right edge of button
                        let leftPos = rect.right - dropdownWidth;
                        
                        // Ensure dropdown doesn't go past right margin
                        if (leftPos + dropdownWidth > maxRight) {
                          leftPos = maxRight - dropdownWidth;
                        }
                        
                        // Ensure dropdown doesn't go past left margin (after sidebar)
                        if (leftPos < minLeft) {
                          leftPos = minLeft;
                        }
                        
                        el.style.top = (rect.bottom + 4) + 'px';
                        el.style.left = leftPos + 'px';
                      }
                    }
                  }}
                >
                  <div 
                    onClick={() => { 
                      setSortOrder('newest'); 
                      setDateFilter({ type: 'all', startDate: '', endDate: '' }); 
                      setShowFilterMenu(false); 
                    }}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: (sortOrder === 'newest' && dateFilter.type === 'all') ? '#f3f4f6' : 'white',
                      fontWeight: (sortOrder === 'newest' && dateFilter.type === 'all') ? 600 : 400,
                      fontSize: '13px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = (sortOrder === 'newest' && dateFilter.type === 'all') ? '#f3f4f6' : 'white'}
                  >
                    🔹 No Filter
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '3px 0' }}></div>
                  <div 
                    onClick={() => { setSortOrder('newest'); setShowFilterMenu(false); }}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: sortOrder === 'newest' ? '#f3f4f6' : 'white',
                      fontWeight: sortOrder === 'newest' ? 600 : 400,
                      fontSize: '13px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = sortOrder === 'newest' ? '#f3f4f6' : 'white'}
                  >
                    🔹 Latest Order to Oldest
                  </div>
                  <div 
                    onClick={() => { setSortOrder('oldest'); setShowFilterMenu(false); }}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: sortOrder === 'oldest' ? '#f3f4f6' : 'white',
                      fontWeight: sortOrder === 'oldest' ? 600 : 400,
                      fontSize: '13px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = sortOrder === 'oldest' ? '#f3f4f6' : 'white'}
                  >
                    🔹 Oldest Order to Latest
                  </div>
                  <div style={{ borderTop: '1px solid #e5e7eb', margin: '3px 0' }}></div>
                  <div 
                    onClick={() => { setDateFilter({ type: 'all', startDate: '', endDate: '' }); setShowFilterMenu(false); }}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: dateFilter.type === 'all' ? '#f3f4f6' : 'white',
                      fontWeight: dateFilter.type === 'all' ? 600 : 400,
                      fontSize: '13px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = dateFilter.type === 'all' ? '#f3f4f6' : 'white'}
                  >
                    🔹 All Dates
                  </div>
                  <div 
                    onClick={() => { setDateFilter({ ...dateFilter, type: 'specific' }); }}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: dateFilter.type === 'specific' ? '#f3f4f6' : 'white',
                      fontWeight: dateFilter.type === 'specific' ? 600 : 400,
                      fontSize: '13px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = dateFilter.type === 'specific' ? '#f3f4f6' : 'white'}
                  >
                    🔹 Specific Date
                  </div>
                  <div 
                    onClick={() => { setDateFilter({ ...dateFilter, type: 'range' }); }}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      background: dateFilter.type === 'range' ? '#f3f4f6' : 'white',
                      fontWeight: dateFilter.type === 'range' ? 600 : 400,
                      fontSize: '13px',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                    onMouseLeave={(e) => e.currentTarget.style.background = dateFilter.type === 'range' ? '#f3f4f6' : 'white'}
                  >
                    🔹 Date Range
                  </div>
                  {dateFilter.type === 'specific' && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <label style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: '6px',
                        display: 'block',
                        width: '100%',
                        textAlign: 'center'
                      }}>
                        📅 Select Date
                      </label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDatePicker('single');
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          border: '2px solid #3b82f6',
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#1f2937',
                          backgroundColor: '#f9fafb',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'center'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.backgroundColor = '#ffffff';
                          e.target.style.borderColor = '#2563eb';
                          e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.backgroundColor = '#f9fafb';
                          e.target.style.borderColor = '#3b82f6';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        {dateFilter.startDate ? new Date(dateFilter.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Click to select date'}
                      </button>
                    </div>
                  )}
                  {dateFilter.type === 'range' && (
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: '100%' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDatePicker('start');
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '2px solid #3b82f6',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#1f2937',
                            backgroundColor: '#f9fafb',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#ffffff';
                            e.target.style.borderColor = '#2563eb';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#f9fafb';
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          {dateFilter.startDate ? new Date(dateFilter.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Click to select start date'}
                        </button>
                      </div>
                      <div style={{ 
                        width: '30px', 
                        height: '1px', 
                        backgroundColor: '#d1d5db',
                        position: 'relative'
                      }}>
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          fontSize: '11px',
                          color: '#6b7280',
                          fontWeight: 600,
                          backgroundColor: 'white',
                          padding: '0 6px'
                        }}>
                          to
                        </div>
                      </div>
                      <div style={{ width: '100%' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openDatePicker('end');
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            border: '2px solid #3b82f6',
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#1f2937',
                            backgroundColor: '#f9fafb',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            textAlign: 'center'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#ffffff';
                            e.target.style.borderColor = '#2563eb';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#f9fafb';
                            e.target.style.borderColor = '#3b82f6';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          {dateFilter.endDate ? new Date(dateFilter.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Click to select end date'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>,
                document.body
              )}
            </div>
          </div>
        </div>

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
          <div className={`table-scroll-container ${filteredAndSortedOrders.length > 0 && totalPages > 1 ? 'with-pagination' : ''}`}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#e8f4fd' }}>
                <th>Order #</th>
                <th>Name</th>
                <th>Services</th>
                <th>Status</th>
                <th>Completion Date</th>
                <th>Layout/Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedOrders.length > 0 ? (
                currentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.id}</td>
                    <td>{order.appointment?.user?.name || 'N/A'}</td>
                    <td>{order.appointment?.service_type || 'N/A'}</td>
                    <td>
                      <div>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 9999,
                            background: (() => {
                              const s = (order.status || '').toLowerCase();
                              if (s === 'pending') return 'rgba(33, 150, 243, 0.15)';
                              if (s === 'ready to check') return 'rgba(33, 150, 243, 0.15)';
                              if (s === 'completed') return 'rgba(33, 150, 243, 0.15)';
                              if (s === 'finished') return 'rgba(33, 150, 243, 0.15)';
                              if (s === 'cancelled' || s === 'canceled') return 'rgba(33, 150, 243, 0.15)';
                              return 'rgba(0,0,0,0.06)';
                            })(),
                            color: getStatusColor(order.status),
                            fontWeight: 700,
                            lineHeight: 1,
                          }}
                        >
                          {order.status === 'Completed' ? 'Finished' : (order.status || 'Unknown')}
                        </span>
                        {order.total_amount && (
                          <span style={{ display: 'block', fontSize: '12px', color: '#000', marginTop: 4 }}>
                            ₱{order.total_amount.toLocaleString()} total fee
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      {order.completed_at ? (
                        <span style={{ fontSize: '14px', color: '#333' }}>
                          {formatDateForDisplay(order.completed_at)}
                        </span>
                      ) : (
                        <span style={{ fontSize: '14px', color: '#999' }}>N/A</span>
                      )}
                    </td>
                    <td>
                      <span
                        className="action-link"
                        onClick={() => handleViewFile(order)}
                        style={{ color: '#007bff', cursor: 'pointer' }}
                      >
                        View Details
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 20 }}>
                    {dateFilter.type !== 'all' || sortOrder !== 'newest' ? 'No orders match the current filters.' : 'No order history found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Pagination Panel - Fixed at bottom */}
      {filteredAndSortedOrders.length > 0 && totalPages > 1 && (
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
              Showing {currentOrders.length} of {filteredAndSortedOrders.length} results
            </span>
          </div>
        </div>
      )}

        {/* Details Modal (Dashboard design) */}
        {showDetails && selectedOrder && (
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
              <h2 className="dashboard-modal-title" style={{ marginTop: 0, paddingTop: 0 }}>Order Details</h2>
                <div className="details-container" style={{ flexWrap: 'wrap', overflowY: 'auto', maxHeight: 'calc(80vh - 80px)' }}>
                  <div className="details-left">
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Full Name</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.user?.name || 'N/A'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Appointment Date Accepted</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.appointment_date ? new Date(selectedOrder.appointment.appointment_date).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Service Type</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.service_type || 'N/A'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Size</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>
                        {(() => {
                          const rawSizes = selectedOrder.appointment?.sizes;
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
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Quantity</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>
                        {selectedOrder.appointment?.total_quantity || (() => {
                          const rawSizes = selectedOrder.appointment?.sizes;
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
                    </div>
                    {(selectedOrder.status === 'Finished' || selectedOrder.status === 'Completed') && selectedOrder.total_amount && (
                      <div className="detail-group">
                        <div className="detail-label" style={{ fontWeight: 600 }}>Total Payment Fee</div>
                        <div className="detail-value" style={{ fontWeight: 400 }}>₱{selectedOrder.total_amount}</div>
                      </div>
                    )}
                  </div>
                  <div className="details-right">
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Due Date</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.preferred_due_date ? new Date(selectedOrder.appointment.preferred_due_date).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Current Status</div>
                      <div className="detail-value" style={{ color: getStatusColor(selectedOrder.status), fontWeight: 400 }}>
                        {selectedOrder.status === 'Completed' ? 'Finished' : selectedOrder.status}
                      </div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Notes</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.notes || 'No notes provided.'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '4px' }}>
                      <div>
                        <div className="image-label" style={{ fontWeight: 600 }}>Design Image</div>
                        {selectedOrder.appointment?.design_image ? (
                          <img 
                            src={getImageUrl(selectedOrder.appointment.design_image)} 
                            alt="Design" 
                            className="dashboard-modal-image"
                            onClick={() => handleImageClick(
                              getImageUrl(selectedOrder.appointment.design_image),
                              'Design Image'
                            )}
                            onError={handleImageError}
                          />
                        ) : (
                          <p style={{ marginBottom: '0' }}>No design image was uploaded.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Image Zoom Modal (Dashboard design) */}
      {showImageModal && selectedImage && (
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
      )}

      {/* Date Picker Calendar Modal */}
      {showDatePickerModal && (
        <div className="orders-calendar-modal-bg" onClick={closeDatePicker}>
          <div className="orders-calendar-modal-panel" onClick={e => e.stopPropagation()}>
            <div className="orders-calendar-modal-header">
              <FaTimes className="orders-calendar-modal-exit" onClick={closeDatePicker} />
              <h2>
                {datePickerType === 'single' && 'Select Date'}
                {datePickerType === 'start' && 'Select Start Date'}
                {datePickerType === 'end' && 'Select End Date'}
              </h2>
            </div>
            <div className="orders-calendar-section">
              <div className="orders-calendar-header">
                <button className="orders-nav-btn" onClick={handleDatePickerPrevMonth}><FaChevronLeft /></button>
                <span>{monthNames[datePickerMonth]} {datePickerYear}</span>
                <button className="orders-nav-btn" onClick={handleDatePickerNextMonth}><FaChevronRight /></button>
              </div>
              <div className="orders-calendar-grid">
                <div className="orders-calendar-days">
                  <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
                </div>
                <div className="orders-calendar-dates">
                  {getCalendarDays().map((day, idx) => {
                    const isCurrentMonth = datePickerMonth === currentMonth && datePickerYear === currentYear;
                    const isToday = isCurrentMonth && day === todayDate;
                    const isSelected = tempSelectedDate && 
                      tempSelectedDate === `${datePickerYear}-${String(datePickerMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    
                    return (
                      <div
                        key={idx}
                        className={`orders-calendar-date${!day ? ' empty' : ''}${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
                        onClick={() => day && handleDateSelect(day)}
                      >
                        {day && <span className="orders-date-number">{day}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              className="orders-set-date-btn"
              onClick={confirmDateSelection}
              disabled={!tempSelectedDate}
            >
              Confirm Date
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersHistory;
