import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate } from 'react-router-dom';
import '../styles/Orders.css';
import '../styles/Feedback.css';
import { FaTimes, FaChevronLeft, FaChevronRight, FaFilter, FaSearch, FaCheck, FaEdit } from 'react-icons/fa';
import { AiOutlineClose } from 'react-icons/ai';
import api from '../api';

const formatTimeToAMPM = (timeString) => {
  if (!timeString) return '';
  
  try {
    // Handle different time formats
    let timeObj;
    if (timeString.includes('T')) {
      // ISO format with T
      timeObj = new Date(timeString);
    } else if (timeString.includes(' ')) {
      // Date and time separated by space
      timeObj = new Date(timeString);
    } else {
      // Just time string (HH:MM)
      const [hours, minutes] = timeString.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) {
        return '';
      }
      timeObj = new Date();
      timeObj.setHours(hours, minutes, 0, 0);
    }

    if (isNaN(timeObj.getTime())) {
      return '';
    }

    const result = timeObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    
    return result;
  } catch (error) {
    return '';
  }
};

const Orders = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsClosing, setDetailsClosing] = useState(false);
  const [showUpdateDropdown, setShowUpdateDropdown] = useState(null);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showCompletionCalendar, setShowCompletionCalendar] = useState(false);
  const [calendarOrderId, setCalendarOrderId] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [bookedCheckTimes, setBookedCheckTimes] = useState([]);
  const [calendarSuccess, setCalendarSuccess] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrderId, setPaymentOrderId] = useState(null);
  const [paymentFee, setPaymentFee] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showFinishConfirmation, setShowFinishConfirmation] = useState(false);
  const [orderToFinish, setOrderToFinish] = useState(null);
  const [completionCalendarMonth, setCompletionCalendarMonth] = useState(new Date().getMonth());
  const [completionCalendarYear, setCompletionCalendarYear] = useState(new Date().getFullYear());
  const [completionSelectedDay, setCompletionSelectedDay] = useState(null);
  const [completionSelectedTime, setCompletionSelectedTime] = useState('');
  const [bookedPickupTimes, setBookedPickupTimes] = useState([]);
  const [filterOption, setFilterOption] = useState('none');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const filterBtnRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [handledSuccess, setHandledSuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [editingSizes, setEditingSizes] = useState(false);
  const [editSizes, setEditSizes] = useState({});
  const [editQuantity, setEditQuantity] = useState('');
  const [savingSizes, setSavingSizes] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState(null);
  const [refundImageFile, setRefundImageFile] = useState(null);
  const [refundImagePreview, setRefundImagePreview] = useState(null);
  const [refunding, setRefunding] = useState(false);
  const [refundSuccess, setRefundSuccess] = useState(false);
  const SIZES = ['Extra Small', 'Small', 'Medium', 'Large', 'Extra Large'];

  const today = new Date();
  const todayDate = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const isCurrentMonth = calendarMonth === currentMonth && calendarYear === currentYear;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const currentMonthName = monthNames[calendarMonth];
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1).getDay();
  const calendarDays = [
    ...Array(firstDayOfMonth).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array((7 - (firstDayOfMonth + daysInMonth) % 7) % 7).fill(null)
  ];

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/login');
      return;
    }
  }, [navigate]);

  const fetchOrders = useCallback(async (signal = null) => {
    // Optimistic UI - only show loading if request takes longer than 150ms
    const showLoadingTimeout = setTimeout(() => {
      setLoading(true);
    }, 150);
    
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        clearTimeout(showLoadingTimeout);
        setError('No admin token found');
        setLoading(false);
        navigate('/login');
        return;
      }

      const config = signal ? { signal } : {};
      const response = await api.get('/orders', config);
      
      if (signal?.aborted) {
        clearTimeout(showLoadingTimeout);
        return;
      }
      clearTimeout(showLoadingTimeout);
      
      if (response.data.success) {
        setOrders(response.data.data);
        setError(null);
      } else {
        setError('Failed to fetch orders');
      }
      setLoading(false);
    } catch (err) {
      if (signal?.aborted || err.name === 'CanceledError' || err.name === 'AbortError') {
        clearTimeout(showLoadingTimeout);
        return;
      }
      clearTimeout(showLoadingTimeout);
      if (err.response?.status === 401) {
        setError('Unauthorized. Please login again.');
        localStorage.removeItem('adminToken');
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Error fetching orders');
      }
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    // Create abort controller for request cancellation
    const abortController = new AbortController();
    const { signal } = abortController;
    
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      fetchOrders(signal);
    }
    
    return () => {
      abortController.abort();
    };
  }, [fetchOrders]);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showUpdateDropdown && !event.target.closest('.update-dropdown') && !event.target.closest('.update-btn')) {
        setShowUpdateDropdown(null);
      }
      if (showFilterDropdown && !event.target.closest('.filter-dropdown') && !event.target.closest('.filter-btn')) {
        setShowFilterDropdown(false);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUpdateDropdown, showFilterDropdown]);


  const handleCalendarPrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const handleSetDateTime = async () => {
    if (calendarOrderId && selectedDay && selectedTime) {
      try {
        const formattedDate = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        const scheduledAt = `${formattedDate} ${selectedTime}`;
        
        const response = await api.patch(`/orders/${calendarOrderId}/status`, {
          status: 'Ready to Check',
          scheduled_at: scheduledAt,
          check_appointment_date: formattedDate,
          check_appointment_time: selectedTime,
        });

        if (response.data.success) {
          setOrders(orders.map(order =>
            order.id === calendarOrderId
              ? {
                  ...order,
                  status: 'Ready to Check',
                  scheduled_at: scheduledAt,
                  check_appointment_date: formattedDate,
                  check_appointment_time: selectedTime,
                  handled: false,
                }
              : order
          ));
          setShowCalendarModal(false);
          setCalendarSuccess(true);
          setTimeout(() => setCalendarSuccess(false), 3000);
        }
      } catch (err) {
        setError('Failed to update order status');
      }
    }
  };

  const handleSetCompletionDateTime = async () => {
    if (calendarOrderId && completionSelectedDay && completionSelectedTime) {
      try {
        const formattedDate = `${completionCalendarYear}-${String(completionCalendarMonth + 1).padStart(2, '0')}-${String(completionSelectedDay).padStart(2, '0')}`;
        const completedAt = `${formattedDate} ${completionSelectedTime}`;
        
        setOrders(orders.map(order =>
          order.id === calendarOrderId
            ? {
                ...order,
                completionDateTime: completedAt,
                pickup_appointment_date: formattedDate,
                pickup_appointment_time: completionSelectedTime,
              }
            : order
        ));
        
        setPaymentOrderId(calendarOrderId);
        setShowCompletionCalendar(false);
        setShowPaymentModal(true);
      } catch (err) {
        setError('Failed to set completion date');
      }
    }
  };

  const handleCalendarNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const handleCompletionCalendarPrevMonth = () => {
    if (completionCalendarMonth === 0) {
      setCompletionCalendarMonth(11);
      setCompletionCalendarYear(completionCalendarYear - 1);
    } else {
      setCompletionCalendarMonth(completionCalendarMonth - 1);
    }
  };

  const handleCompletionCalendarNextMonth = () => {
    if (completionCalendarMonth === 11) {
      setCompletionCalendarMonth(0);
      setCompletionCalendarYear(completionCalendarYear + 1);
    } else {
      setCompletionCalendarMonth(completionCalendarMonth + 1);
    }
  };

  const openCalendarModal = (orderId) => {
    setCalendarOrderId(orderId);
    setShowCalendarModal(true);
    setSelectedDay(null);
    setSelectedTime('');
    setCalendarMonth(currentMonth);
    setCalendarYear(currentYear);
    setBookedCheckTimes([]);
  };

  const openCompletionCalendarModal = (orderId) => {
    setCalendarOrderId(orderId);
    setShowCompletionCalendar(true);
    setCompletionSelectedDay(null);
    setCompletionSelectedTime('');
    setCompletionCalendarMonth(currentMonth);
    setCompletionCalendarYear(currentYear);
    setBookedPickupTimes([]);
  };

  const closeCalendarModal = () => {
    setShowCalendarModal(false);
    setCalendarOrderId(null);
    setSelectedDay(null);
    setSelectedTime('');
    setBookedCheckTimes([]);
  };

  const closeCompletionCalendarModal = () => {
    setShowCompletionCalendar(false);
    setCalendarOrderId(null);
    setCompletionSelectedDay(null);
    setCompletionSelectedTime('');
    setBookedPickupTimes([]);
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
        } else if (showCalendarModal) {
          closeCalendarModal();
        } else if (showCompletionCalendar) {
          closeCompletionCalendarModal();
        } else if (showPaymentModal) {
          setShowPaymentModal(false);
        } else if (showRefundModal) {
          setShowRefundModal(false);
          setRefundOrderId(null);
          setRefundImageFile(null);
          setRefundImagePreview(null);
        } else if (showImageModal) {
          setShowImageModal(false);
        } else if (showFinishConfirmation) {
          setShowFinishConfirmation(false);
          setOrderToFinish(null);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showDetails, showCalendarModal, showCompletionCalendar, showPaymentModal, showRefundModal, showImageModal, showFinishConfirmation]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'Ready to Check':
        return '#b23c17'; // darker orange text
      case 'Pending':
        return '#7a5f00'; // darker yellow text
      case 'Completed':
        return '#2e7d32';
      case 'Finished':
        return '#1565c0';
      case 'Cancelled':
        return '#616161'; // Grey color for cancelled
      default:
        return '#333';
    }
  };

  const handleViewFile = (order) => {
    setSelectedOrder(order);
    setShowDetails(true);
    setEditingSizes(false);
    // Initialize edit state with current sizes
    const rawSizes = order.appointment?.sizes;
    if (rawSizes) {
      try {
        const parsed = typeof rawSizes === 'string' ? JSON.parse(rawSizes) : rawSizes;
        if (parsed && typeof parsed === 'object') {
          setEditSizes(parsed);
          const total = Object.values(parsed).reduce((a, b) => Number(a) + Number(b), 0);
          setEditQuantity(String(total));
        } else {
          setEditSizes({});
          setEditQuantity('0');
        }
      } catch (_) {
        setEditSizes({});
        setEditQuantity('0');
      }
    } else {
      setEditSizes({});
      setEditQuantity('0');
    }
  };

  const handleToggleHandled = async (orderId, handled) => {
    try {
      const token = localStorage.getItem('adminToken');
      if (!token) {
        setError('No admin token found');
        navigate('/login');
        return;
      }

      const response = await api.patch(`/orders/${orderId}/handled`, {
        handled: handled
      });

      if (response.data.success) {
        setOrders(orders.map(order =>
          order.id === orderId
            ? { ...order, handled: response.data.data.handled }
            : order
        ));
        setHandledSuccess(true);
        setTimeout(() => setHandledSuccess(false), 3000);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Unauthorized. Please login again.');
        localStorage.removeItem('adminToken');
        navigate('/login');
      } else {
        setError('Failed to update handled status');
      }
    }
  };

  const handleUpdateStatus = async (orderId, newStatus) => {
    if (newStatus === 'Ready to Check') {
      openCalendarModal(orderId);
      setShowUpdateDropdown(null);
      return;
    }
    if (newStatus === 'Completed') {
      openCompletionCalendarModal(orderId);
      setShowUpdateDropdown(null);
      return;
    }
    if (newStatus === 'Finished') {
      const order = orders.find(o => o.id === orderId);
      setOrderToFinish(order);
      setShowFinishConfirmation(true);
      setShowUpdateDropdown(null);
      return;
    }
    
    try {
      const response = await api.patch(`/orders/${orderId}/status`, {
        status: newStatus
      });

      if (response.data.success) {
        setOrders(orders.map(order =>
          order.id === orderId
            ? { ...order, status: newStatus, scheduled_at: undefined, handled: false }
            : order
        ));
        setShowUpdateDropdown(null);
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      }
    } catch (err) {
      setError('Failed to update order status');
    }
  };

  const handleFinishOrder = async () => {
    if (!orderToFinish) return;
    
    try {
      const response = await api.patch(`/orders/${orderToFinish.id}/status`, {
        status: 'Finished'
      });

      if (response.data.success) {
        setOrders(orders.filter(order => order.id !== orderToFinish.id));
        setShowFinishConfirmation(false);
        setOrderToFinish(null);
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      }
    } catch (err) {
      setError('Failed to finish order');
    }
  };

  const handleBackToCalendar = () => {
    setShowPaymentModal(false);
    setShowCompletionCalendar(true);
    setPaymentFee('');
  };

  const handlePaymentSubmit = async () => {
    try {
      const order = orders.find(o => o.id === paymentOrderId);
      const pickupDate = order.pickup_appointment_date;
      const pickupTime = order.pickup_appointment_time;
      
      const response = await api.patch(`/orders/${paymentOrderId}/status`, {
        status: 'Completed',
        scheduled_at: order.completionDateTime, 
        total_amount: paymentFee,
        pickup_appointment_date: pickupDate, 
        pickup_appointment_time: pickupTime,
      });
  
      if (response.data.success) {
        const updated = response.data.data;
        setOrders(orders.map(o => (o.id === paymentOrderId ? { ...o, ...updated, handled: false } : o)));
        setShowPaymentModal(false);
        setCalendarSuccess(true);
        setTimeout(() => setCalendarSuccess(false), 3000);
      }
    } catch (err) {
      setError('Failed to submit payment');
    }
  };

  const toggleUpdateDropdown = (orderId) => {
    setShowUpdateDropdown(showUpdateDropdown === orderId ? null : orderId);
  };

  const handleImageClick = (imageSrc, imageAlt) => {
    setSelectedImage({ src: imageSrc, alt: imageAlt });
    setShowImageModal(true);
  };

  const handleSaveSizes = async () => {
    if (!selectedOrder) return;
    
    // Filter out sizes with 0 quantity
    const filteredSizes = Object.fromEntries(
      Object.entries(editSizes).filter(([_, qty]) => Number(qty) > 0)
    );
    const total = Object.values(filteredSizes).reduce((a, b) => Number(a) + Number(b), 0);
    
    if (total <= 0) {
      alert('Please select at least one size with quantity greater than 0');
      return;
    }
    
    try {
      setSavingSizes(true);

      const response = await api.patch(`/orders/${selectedOrder.id}/sizes-quantity`, {
        sizes: JSON.stringify(filteredSizes),
        total_quantity: total
      });

      if (response.data.success) {
        // Update the order in the orders list
        setOrders(orders.map(order =>
          order.id === selectedOrder.id
            ? {
                ...order,
                appointment: {
                  ...order.appointment,
                  sizes: filteredSizes,
                  total_quantity: total
                }
              }
            : order
        ));
        // Update selectedOrder
        setSelectedOrder({
          ...selectedOrder,
          appointment: {
            ...selectedOrder.appointment,
            sizes: filteredSizes,
            total_quantity: total
          }
        });
        setEditingSizes(false);
        setUpdateSuccess(true);
        setTimeout(() => setUpdateSuccess(false), 3000);
      }
    } catch (err) {
      setError('Failed to update sizes and quantity');
    } finally {
      setSavingSizes(false);
    }
  };

  const handleCancelEditSizes = () => {
    setEditingSizes(false);
    // Reset to original values
    const rawSizes = selectedOrder?.appointment?.sizes;
    if (rawSizes) {
      try {
        const parsed = typeof rawSizes === 'string' ? JSON.parse(rawSizes) : rawSizes;
        if (parsed && typeof parsed === 'object') {
          setEditSizes(parsed);
          const total = Object.values(parsed).reduce((a, b) => Number(a) + Number(b), 0);
          setEditQuantity(String(total));
        }
      } catch (_) {
        setEditSizes({});
        setEditQuantity('0');
      }
    }
  };

  const handleRefundOrder = (orderId) => {
    setRefundOrderId(orderId);
    setShowRefundModal(true);
  };

  const handleRefundImageFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setRefundImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setRefundImagePreview(reader.result);
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

      await api.post(`/admin/orders/${refundOrderId}/refund`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Remove order from list after refund is processed
      setOrders(orders.filter(o => o.id !== refundOrderId));
      setShowRefundModal(false);
      setRefundOrderId(null);
      setRefundImageFile(null);
      setRefundImagePreview(null);
      setRefundSuccess(true);
      setTimeout(() => setRefundSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process refund. Please try again.');
    } finally {
      setRefunding(false);
    }
  };

  // Auto-calculate quantity when sizes change
  useEffect(() => {
    if (editingSizes) {
      const total = Object.values(editSizes).reduce((a, b) => Number(a) + Number(b), 0);
      setEditQuantity(String(total));
    }
  }, [editSizes, editingSizes]);

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return '';
    
    try {
      // Handle YYYY-MM-DD format (date-only) without timezone conversion issues
      const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const year = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10) - 1; // JavaScript months are 0-indexed
        const day = parseInt(dateMatch[3], 10);
        
        // Create date using Date.UTC to avoid timezone conversion issues
        const utcDate = new Date(Date.UTC(year, month, day));
        
        if (isNaN(utcDate.getTime())) {
          return '';
        }
        
        // Get date components in local time
        const localMonth = utcDate.getMonth();
        const localDay = utcDate.getDate();
        
        const monthName = monthNames[localMonth];
        return `${monthName} ${localDay}`;
      }
      
      // Handle date strings with time (ISO format or space-separated)
      if (dateString.includes('T') || (dateString.includes(' ') && dateString.includes(':'))) {
        // Parse ISO format or space-separated datetime
        const dateTimeMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (dateTimeMatch) {
          const year = parseInt(dateTimeMatch[1], 10);
          const month = parseInt(dateTimeMatch[2], 10) - 1;
          const day = parseInt(dateTimeMatch[3], 10);
          const hours = parseInt(dateTimeMatch[4], 10);
          const minutes = parseInt(dateTimeMatch[5], 10);
          
          // Create date using Date.UTC to avoid timezone conversion issues
          const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, 0));
          
          if (isNaN(utcDate.getTime())) {
            return '';
          }
          
          // Get date components in local time
          const localMonth = utcDate.getMonth();
          const localDay = utcDate.getDate();
          const localHours = utcDate.getHours();
          const localMinutes = utcDate.getMinutes();
          
          const monthName = monthNames[localMonth];
          const period = localHours >= 12 ? 'PM' : 'AM';
          const hour12 = localHours % 12 === 0 ? 12 : localHours % 12;
          const time = `${hour12}:${localMinutes.toString().padStart(2, '0')} ${period}`;
          
          return `${monthName} ${localDay} - ${time}`;
        }
      }
      
      // Fallback to Date parsing if format doesn't match
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const month = monthNames[date.getMonth()];
      const day = date.getDate();
      
      // If the original string contains time information, include it
      if (dateString.includes('T') || (dateString.includes(' ') && dateString.includes(':'))) {
        const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
        return `${month} ${day} - ${time}`;
      } else {
        return `${month} ${day}`;
      }
    } catch (error) {
      return '';
    }
  };

  const formatDateAndTime = (dateString, timeString) => {
    if (!dateString || !timeString) return '';
    try {
      // Parse date as YYYY-MM-DD (no timezone involved)
      const dateMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!dateMatch) return '';
      const monthIdx = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);

      // Parse time as HH:MM or HH:MM:SS (no timezone involved)
      const timeMatch = timeString.match(/^(\d{2}):(\d{2})/);
      if (!timeMatch) return '';
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);

      // Build display string purely from parsed numeric components
      // This avoids any timezone interpretation
      const monthName = monthNames[monthIdx];
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours % 12 === 0 ? 12 : hours % 12;
      const timeStr = `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;

      return `${monthName} ${day} - ${timeStr}`;
    } catch (error) {
      return '';
    }
  };

  const isTimeSlotBooked = (time, kind) => {
    if (kind === 'check') {
      return bookedCheckTimes.includes(time);
    }
    if (kind === 'pickup') {
      return bookedPickupTimes.includes(time);
    }
    return false;
  };
  useEffect(() => {
    const fetch = async () => {
      if (showCalendarModal && selectedDay) {
        const date = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
        
        // Check if the selected date is in the past
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
          setBookedCheckTimes([]);
          return;
        }
        
        try {
          const res = await api.get('/orders/booked-times', { 
            params: { 
              date, 
              kind: 'check',
              order_id: calendarOrderId // Exclude current order's times
            } 
          });
          setBookedCheckTimes(res.data?.booked_times || []);
        } catch (_) {
          setBookedCheckTimes([]);
        }
      }
    };
    fetch();
  }, [showCalendarModal, selectedDay, calendarMonth, calendarYear, calendarOrderId]);

  useEffect(() => {
    const fetch = async () => {
      if (showCompletionCalendar && completionSelectedDay) {
        const date = `${completionCalendarYear}-${String(completionCalendarMonth + 1).padStart(2, '0')}-${String(completionSelectedDay).padStart(2, '0')}`;
        
        // Check if the selected date is in the past
        const selectedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
          setBookedPickupTimes([]);
          return;
        }
        
        try {
          const res = await api.get('/orders/booked-times', { 
            params: { 
              date, 
              kind: 'pickup',
              order_id: calendarOrderId // Exclude current order's times
            } 
          });
          setBookedPickupTimes(res.data?.booked_times || []);
        } catch (_) {
          setBookedPickupTimes([]);
        }
      }
    };
    fetch();
  }, [showCompletionCalendar, completionSelectedDay, completionCalendarMonth, completionCalendarYear, calendarOrderId]);

  // Reset to page 1 when filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterOption, searchQuery]);

  // Scroll to top whenever page changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure scroll happens after DOM update
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, [currentPage]);

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
        const minuteStr = minute < 10 ? `0${minute}` : `${minute}`;
        const time = `${hourStr}:${minuteStr}`;
        // Exclude lunch time (12:00 and 12:30)
        if (time !== '12:00' && time !== '12:30') {
          slots.push(time);
        }
      }
    }
    return slots;
  };

  // Helper function to get filter display name
  const getFilterDisplayName = (filter) => {
    switch(filter) {
      case 'none':
        return 'No Filter';
      case 'deadline-nearest':
        return 'Nearest Due Date';
      case 'oldest-newest':
        return 'Oldest to Newest';
      case 'newest-oldest':
        return 'Newest to Oldest';
      case 'status-pending':
        return 'Status: Pending';
      case 'status-ready':
        return 'Status: Ready to Check';
      case 'status-completed':
        return 'Status: Completed';
      case 'attended':
        return 'Attended';
      case 'not-attended':
        return 'Not Attended';
      default:
        return 'No Filter';
    }
  };

  // Filter and sort orders based on selected filter and search query - memoized for performance
  // IMPORTANT: This hook must be called before any early returns to follow React Hooks rules
  const { filteredOrders, totalPages, currentOrders } = useMemo(() => {
    let filtered = [...orders];
    
    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order => {
        const name = order.appointment?.user?.name?.toLowerCase() || '';
        const service = order.appointment?.service_type?.toLowerCase() || '';
        return name.includes(query) || service.includes(query);
      });
    }
    
    switch(filterOption) {
      case 'deadline-nearest':
        // Sort by nearest deadline (preferred_due_date)
        filtered.sort((a, b) => {
          const dateA = a.appointment?.preferred_due_date ? new Date(a.appointment.preferred_due_date) : new Date('9999-12-31');
          const dateB = b.appointment?.preferred_due_date ? new Date(b.appointment.preferred_due_date) : new Date('9999-12-31');
          return dateA - dateB;
        });
        break;
      case 'oldest-newest':
        // Sort by order creation date (oldest first)
        filtered.sort((a, b) => a.id - b.id);
        break;
      case 'newest-oldest':
        // Sort by order creation date (newest first)
        filtered.sort((a, b) => b.id - a.id);
        break;
      case 'status-pending':
        filtered = filtered.filter(order => order.status === 'Pending');
        break;
      case 'status-ready':
        filtered = filtered.filter(order => order.status === 'Ready to Check');
        break;
      case 'status-completed':
        filtered = filtered.filter(order => order.status === 'Completed');
        break;
      case 'attended':
        filtered = filtered.filter(order => order.handled === true);
        break;
      case 'not-attended':
        filtered = filtered.filter(order => order.handled === false);
        break;
      default:
        // No filter applied
        break;
    }
    
    // Pagination calculations
    const total = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const current = filtered.slice(start, end);
    
    return { filteredOrders: filtered, totalPages: total, currentOrders: current };
  }, [orders, searchQuery, filterOption, currentPage, itemsPerPage]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  if (loading) {
    return (
      <div className="page-wrap orders-page-unique">
        <div className="orders-content orders-page-content" style={{ marginTop: 8 }}>
          <p>Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-wrap orders-page-unique">
        <div className="orders-content orders-page-content" style={{ marginTop: 8 }}>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap orders-page-unique">
      <div className="orders-content orders-page-content" style={{ marginTop: 8 }}>
          {/* Search and Filter Section - OUTSIDE the table container */}
          <div className="orders-page-search-filter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 16px 16px 16px', position: 'relative', zIndex: 10 }}>
            {/* Search Bar */}
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
                placeholder="Search orders by name or service"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
            
            {/* Current Filter Display and Filter Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Display current filter */}
              <div style={{
                fontSize: 14,
                fontWeight: 600,
                color: filterOption === 'none' ? '#6b7280' : '#2563eb',
                padding: '6px 12px',
                background: filterOption === 'none' ? '#f3f4f6' : '#dbeafe',
                borderRadius: 6,
                border: filterOption === 'none' ? '1px solid #e5e7eb' : '1px solid #93c5fd',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}>
                {getFilterDisplayName(filterOption)}
              </div>
              
              <div style={{ position: 'relative' }}>
                <button 
                  ref={filterBtnRef}
                  className="filter-btn"
                  data-filter-btn="true"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
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
                {showFilterDropdown && ReactDOM.createPortal(
                  <div 
                    className="filter-dropdown"
                    ref={(el) => {
                      if (el) {
                        const btn = filterBtnRef.current || document.querySelector('button[data-filter-btn="true"]');
                        if (btn) {
                          const rect = btn.getBoundingClientRect();
                          const dropdownWidth = el.offsetWidth || 220; // Default width or actual width
                          
                          // Calculate sidebar width (matches CSS clamp(200px, 20vw, 250px))
                          const sidebarWidth = Math.min(Math.max(200, window.innerWidth * 0.2), 250);
                          const pageMargin = window.innerWidth <= 768 ? 8 : 16; // Responsive margin
                          const contentLeft = sidebarWidth; // Content area starts after sidebar
                          const maxRight = window.innerWidth - pageMargin;
                          const minLeft = contentLeft + pageMargin; // Minimum left position (after sidebar + margin)
                          
                          // Position aligned to left edge of button
                          let leftPos = rect.left;
                          
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
                      <div style={{ padding: '8px 0' }}>
                        <div 
                          onClick={() => { setFilterOption('none'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'none' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'none' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'none' ? '#f3f4f6' : 'white'}
                        >
                          🔹 No Filter
                        </div>
                        <div 
                          onClick={() => { setFilterOption('deadline-nearest'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'deadline-nearest' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'deadline-nearest' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'deadline-nearest' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Nearest Due Date
                        </div>
                        <div 
                          onClick={() => { setFilterOption('oldest-newest'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'oldest-newest' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'oldest-newest' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'oldest-newest' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Oldest to Newest
                        </div>
                        <div 
                          onClick={() => { setFilterOption('newest-oldest'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'newest-oldest' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'newest-oldest' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'newest-oldest' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Newest to Oldest
                        </div>
                        <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }}></div>
                        <div 
                          onClick={() => { setFilterOption('status-pending'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'status-pending' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'status-pending' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'status-pending' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Status: Pending
                        </div>
                        <div 
                          onClick={() => { setFilterOption('status-ready'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'status-ready' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'status-ready' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'status-ready' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Status: Ready to Check
                        </div>
                        <div 
                          onClick={() => { setFilterOption('status-completed'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'status-completed' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'status-completed' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'status-completed' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Status: Completed
                        </div>
                        <div style={{ borderTop: '1px solid #e5e7eb', margin: '4px 0' }}></div>
                        <div 
                          onClick={() => { setFilterOption('attended'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'attended' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'attended' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'attended' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Attended
                        </div>
                        <div 
                          onClick={() => { setFilterOption('not-attended'); setShowFilterDropdown(false); }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            background: filterOption === 'not-attended' ? '#f3f4f6' : 'white',
                            fontWeight: filterOption === 'not-attended' ? 600 : 400,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.background = filterOption === 'not-attended' ? '#f3f4f6' : 'white'}
                        >
                          🔹 Not Attended
                        </div>
                      </div>
                  </div>,
                  document.body
                )}
              </div>
            </div>
          </div>
          
          <div
            className="feedback-card-container orders-page-table-container"
            style={{
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16,
              marginBottom: 10,
              overflow: 'hidden',
              padding: '24px 16px 8px 16px',
              margin: '0 16px 40px 16px',
              maxWidth: 'none',
              width: 'auto'
            }}
          >
            {orders.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px 0' }}>No orders found.</p>
            ) : (
            <div className={`table-scroll-container with-pagination`}>
           <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
               <tr style={{ background: '#e8f4fd' }}>
   <th style={{ width: '75px', whiteSpace: 'normal', wordWrap: 'break-word' }}>Order #</th>
   <th style={{ width: '105px' }}>Name</th>
   <th style={{ width: '135px' }}>Services</th>
   <th style={{ width: '105px' }}>Due Date</th>
   <th style={{ width: '125px' }}>Status</th>
   <th style={{ width: '100px' }}>Attended</th>
   <th style={{ width: '110px' }}>Next Appoint.</th>
   <th style={{ width: '115px' }}>Details</th>
   <th style={{ width: '95px' }}>Actions</th>
 </tr>

              </thead>
              <tbody>
                {currentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: '600', color: '#000' }}>#{order.id}</span>
                      </div>
                    </td>
                    <td>{order.appointment?.user?.name || 'N/A'}</td>
                    <td>{order.appointment?.service_type || 'N/A'}</td>
                    <td>
                      {order.appointment?.preferred_due_date ? (
                        <span>{(() => {
                          // Parse date manually to avoid timezone conversion issues
                          const dateStr = order.appointment.preferred_due_date;
                          const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                          if (dateMatch) {
                            const year = parseInt(dateMatch[1], 10);
                            const month = parseInt(dateMatch[2], 10) - 1;
                            const day = parseInt(dateMatch[3], 10);
                            // Use monthNames array for consistent formatting
                            const monthName = monthNames[month];
                            return `${monthName} ${day}, ${year}`;
                          }
                          // Fallback
                          return dateStr;
                        })()}</span>
                      ) : (
                        <span style={{ color: '#999' }}>N/A</span>
                      )}
                    </td>
                    <td>
                      <div>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 9999,
                          background: (() => {
                            const s = order.status;
                            if (s === 'Pending') return 'rgba(255, 224, 130, 0.5)';
                            if (s === 'Ready to Check') return 'rgba(255, 171, 145, 0.5)';
                            if (s === 'Completed') return 'rgba(76, 175, 80, 0.15)';
                            if (s === 'Finished') return 'rgba(33, 150, 243, 0.15)';
                            if (s === 'Cancelled') return 'rgba(158, 158, 158, 0.15)';
                            return 'rgba(0,0,0,0.06)';
                          })(),
                          color: getStatusColor(order.status),
                          fontWeight: 700,
                          lineHeight: 1
                        }}>
                          {order.status}
                        </span>
                        {order.status === 'Completed' && order.total_amount && (
                          <span style={{ fontSize: '12px', color: '#000', marginLeft: 8 }}>
                            (₱{order.total_amount} total fee)
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {order.status === 'Cancelled' ? (
                        <span style={{ color: '#999' }}>N/A</span>
                      ) : (
                        <button
                          onClick={() => handleToggleHandled(order.id, !order.handled)}
                          style={{
                            width: '24px',
                            height: '24px',
                            border: `2px solid ${order.handled ? '#4caf50' : '#ccc'}`,
                            borderRadius: '4px',
                            background: order.handled ? '#4caf50' : 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            margin: '0 auto'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            if (!order.handled) {
                              e.currentTarget.style.borderColor = '#4caf50';
                              e.currentTarget.style.background = '#e8f5e9';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            if (!order.handled) {
                              e.currentTarget.style.borderColor = '#ccc';
                              e.currentTarget.style.background = 'white';
                            }
                          }}
                          title={order.handled ? 'Mark as unhandled' : 'Mark as handled'}
                        >
                          {order.handled && (
                            <FaCheck 
                              style={{ 
                                color: 'white',
                                fontSize: '14px'
                              }} 
                            />
                          )}
                        </button>
                      )}
                    </td>
                    <td>
                      {/* NEXT APPOINT COLUMN */}
                      {/* Check if appointment is still pending (Requesting) - don't show reminders if not accepted yet */}
                      {(() => {
                        // FIRST CHECK: If appointment is still pending (Requesting), NEVER show appointment date/time
                        // This must be checked FIRST before any other logic
                        const appointmentStatus = order.appointment?.status;
                        const normalizedStatus = appointmentStatus ? String(appointmentStatus).toLowerCase().trim() : '';
                        
                        // If appointment status is 'pending' (Requesting), don't show any appointment date
                        // This means the appointment hasn't been accepted by admin yet
                        if (normalizedStatus === 'pending') {
                          return <span style={{ color: '#999' }}>No next appointment for now</span>;
                        }
                        
                        // Only proceed to show appointment dates if appointment is accepted (status is 'accepted' or 'rejected')
                        // For Ready to Check: Show admin-set check appointment, otherwise fall back to original user appointment
                        if (order.status === 'Ready to Check') {
                          if (order.check_appointment_date && order.check_appointment_time) {
                            return <span>{formatDateAndTime(order.check_appointment_date, order.check_appointment_time)}</span>;
                          } else if (order.appointment?.appointment_date && order.appointment?.appointment_time) {
                            return <span>{formatDateAndTime(order.appointment.appointment_date, order.appointment.appointment_time)}</span>;
                          } else {
                            return <span style={{ color: '#999' }}>No next appointment for now</span>;
                          }
                        }
                        
                        // For Pending order status: Only show appointment date if appointment is accepted (not pending)
                        if (order.status === 'Pending') {
                          // Double check: even if order status is Pending, don't show if appointment is still pending
                          if (normalizedStatus === 'pending') {
                            return <span style={{ color: '#999' }}>No next appointment for now</span>;
                          }
                          if (order.appointment?.appointment_date && order.appointment?.appointment_time) {
                            return <span>{formatDateAndTime(order.appointment.appointment_date, order.appointment.appointment_time)}</span>;
                          } else {
                            return <span style={{ color: '#999' }}>No next appointment for now</span>;
                          }
                        }
                        
                        // For Completed: Show user's rescheduled appointment first, otherwise fall back to admin-set pickup appointment
                        if (order.status === 'Completed') {
                          if (order.appointment?.appointment_date && order.appointment?.appointment_time) {
                            return <span>{formatDateAndTime(order.appointment.appointment_date, order.appointment.appointment_time)}</span>;
                          } else if (order.pickup_appointment_date && order.pickup_appointment_time) {
                            return <span>{formatDateAndTime(order.pickup_appointment_date, order.pickup_appointment_time)}</span>;
                          } else {
                            return <span style={{ color: '#999' }}>No next appointment for now</span>;
                          }
                        }
                        
                        // For Finished: N/A
                        if (order.status === 'Finished') {
                          return <span>N/A</span>;
                        }
                        
                        // For Cancelled: N/A
                        if (order.status === 'Cancelled') {
                          return <span style={{ color: '#999' }}>N/A</span>;
                        }
                        
                        // Default fallback
                        return <span style={{ color: '#999' }}>No next appointment for now</span>;
                      })()}
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
                    <td>
                      {order.status === 'Cancelled' ? (
                        <button
                          onClick={() => handleRefundOrder(order.id)}
                          style={{
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px 16px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'background-color 0.3s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#d32f2f';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#f44336';
                          }}
                        >
                          Refund
                        </button>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <button
                            className="update-btn"
                            data-order-id={order.id}
                            onClick={() => toggleUpdateDropdown(order.id)}
                            style={{
                              backgroundColor: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '8px 16px',
                              cursor: 'pointer',
                              transition: 'background-color 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.backgroundColor = '#1d4ed8';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.backgroundColor = '#3b82f6';
                            }}
                          >
                            Update
                          </button>
                          {showUpdateDropdown === order.id && ReactDOM.createPortal(
                            <div 
                              className="update-dropdown"
                              ref={(el) => {
                                if (el) {
                                  const btn = document.querySelector(`button[data-order-id="${order.id}"]`);
                                  if (btn) {
                                    const rect = btn.getBoundingClientRect();
                                    el.style.top = (rect.bottom + 4) + 'px';
                                    el.style.left = (rect.left + rect.width / 2 - el.offsetWidth / 2) + 'px';
                                  }
                                }
                              }}
                            >
                              <div
                                className="dropdown-item"
                                onClick={() => handleUpdateStatus(order.id, 'Pending')}
                              >
                                Pending
                              </div>
                              <div
                                className="dropdown-item"
                                onClick={() => handleUpdateStatus(order.id, 'Ready to Check')}
                              >
                                Ready to check
                              </div>
                              <div
                                className="dropdown-item"
                                onClick={() => handleUpdateStatus(order.id, 'Completed')}
                              >
                                Completed
                              </div>
                              <div
                                className="dropdown-item"
                                onClick={() => handleUpdateStatus(order.id, 'Finished')}
                              >
                                Finished
                              </div>
                            </div>,
                            document.body
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            )}
          </div>

          {/* Pagination Panel - Fixed at bottom */}
          {!loading && !error && filteredOrders.length > 0 && (
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
                  Showing {currentOrders.length} of {filteredOrders.length} results
                </span>
              </div>
            </div>
          )}

          {/* View File Modal (Dashboard design) */}
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
                      <div className="detail-label" style={{ fontWeight: 600 }}>Order Number</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>#{selectedOrder.id}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Full Name</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.user?.name || 'N/A'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Service Type</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.service_type || 'N/A'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Phone Number</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.user?.phone || selectedOrder.appointment?.user?.phone_number || 'N/A'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Size
                        {!editingSizes && (
                          <FaEdit 
                            style={{ cursor: 'pointer', color: '#3b82f6', fontSize: '14px' }}
                            onClick={() => setEditingSizes(true)}
                            title="Edit sizes"
                          />
                        )}
                      </div>
                      {!editingSizes ? (
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
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                          {SIZES.map((size) => (
                            <div key={size} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="checkbox"
                                checked={editSizes[size] !== undefined && editSizes[size] > 0}
                                onChange={(e) => {
                                  setEditSizes((prev) => ({
                                    ...prev,
                                    [size]: e.target.checked ? 1 : 0
                                  }));
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              <label style={{ flex: 1, cursor: 'pointer' }} onClick={() => {
                                setEditSizes((prev) => ({
                                  ...prev,
                                  [size]: prev[size] > 0 ? 0 : 1
                                }));
                              }}>
                                {size}
                              </label>
                              {editSizes[size] !== undefined && editSizes[size] > 0 && (
                                <input
                                  type="number"
                                  min="1"
                                  value={editSizes[size] || 0}
                                  onChange={(e) => {
                                    const num = parseInt(e.target.value) || 0;
                                    setEditSizes((prev) => ({
                                      ...prev,
                                      [size]: num
                                    }));
                                  }}
                                  style={{
                                    width: '60px',
                                    padding: '4px 8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px'
                                  }}
                                />
                              )}
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <button
                              onClick={handleSaveSizes}
                              disabled={savingSizes}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: savingSizes ? 'not-allowed' : 'pointer',
                                opacity: savingSizes ? 0.6 : 1
                              }}
                            >
                              {savingSizes ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEditSizes}
                              disabled={savingSizes}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: savingSizes ? 'not-allowed' : 'pointer'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Quantity</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>
                        {editingSizes ? editQuantity : (selectedOrder.appointment?.total_quantity || (() => {
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
                        })())}
                      </div>
                    </div>
                    {selectedOrder.status === 'Completed' && selectedOrder.total_amount && (
                      <div className="detail-group">
                        <div className="detail-label" style={{ fontWeight: 600 }}>Total Payment Fee</div>
                        <div className="detail-value" style={{ fontWeight: 400 }}>₱{selectedOrder.total_amount}</div>
                      </div>
                    )}
                  </div>
                  <div className="details-right">
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Due Date</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.preferred_due_date ? (() => {
                        const dateStr = selectedOrder.appointment.preferred_due_date;
                        const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                        if (dateMatch) {
                          const year = parseInt(dateMatch[1], 10);
                          const month = parseInt(dateMatch[2], 10) - 1;
                          const day = parseInt(dateMatch[3], 10);
                          const date = new Date(year, month, day);
                          return date.toLocaleDateString();
                        }
                        return dateStr;
                      })() : 'N/A'}</div>
                    </div>
                    {selectedOrder.status === 'Completed' && selectedOrder.completed_at && (
                      <div className="detail-group">
                        <div className="detail-label" style={{ fontWeight: 600 }}>Completion Date</div>
                        <div className="detail-value" style={{ fontWeight: 400 }}>{formatDateForDisplay(selectedOrder.completed_at)}</div>
                      </div>
                    )}
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Current Status</div>
                      <div className="detail-value">
                        <span style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 9999,
                          background: (() => {
                            const s = selectedOrder.status;
                            if (s === 'Pending') return 'rgba(255, 224, 130, 0.5)';
                            if (s === 'Ready to Check') return 'rgba(255, 171, 145, 0.5)';
                            if (s === 'Completed') return 'rgba(76, 175, 80, 0.15)';
                            if (s === 'Finished') return 'rgba(33, 150, 243, 0.15)';
                            if (s === 'Cancelled') return 'rgba(158, 158, 158, 0.15)';
                            return 'rgba(0,0,0,0.06)';
                          })(),
                          color: getStatusColor(selectedOrder.status),
                          fontWeight: 700,
                          lineHeight: 1
                        }}>
                          {selectedOrder.status}
                        </span>
                      </div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Notes</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.notes || 'No notes provided.'}</div>
                    </div>
                    <div className="detail-group">
                      <div className="detail-label" style={{ fontWeight: 600 }}>Appointment Date Accepted</div>
                      <div className="detail-value" style={{ fontWeight: 400 }}>{selectedOrder.appointment?.appointment_date ? (() => {
                        const dateStr = selectedOrder.appointment.appointment_date;
                        const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                        if (dateMatch) {
                          const year = parseInt(dateMatch[1], 10);
                          const month = parseInt(dateMatch[2], 10) - 1;
                          const day = parseInt(dateMatch[3], 10);
                          const date = new Date(year, month, day);
                          return date.toLocaleDateString();
                        }
                        return dateStr;
                      })() : 'N/A'}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginTop: '4px' }}>
                      <div>
                        <div className="image-label" style={{ fontWeight: 600 }}>Design Image</div>
                        {selectedOrder.appointment?.design_image ? (
                          <img 
                            src={selectedOrder.appointment.design_image} 
                            alt="Design" 
                            className="dashboard-modal-image"
                            onClick={() => handleImageClick(
                              selectedOrder.appointment.design_image,
                              'Design Image'
                            )}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <p style={{ marginBottom: '0' }}>No design image available</p>
                        )}
                      </div>
                      <div>
                        <div className="image-label" style={{ fontWeight: 600 }}>GCash Proof</div>
                        {selectedOrder.appointment?.gcash_proof ? (
                          <img 
                            src={selectedOrder.appointment.gcash_proof} 
                            alt="GCash Proof" 
                            className="dashboard-modal-image"
                            onClick={() => handleImageClick(
                              selectedOrder.appointment.gcash_proof,
                              'GCash Proof'
                            )}
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <p style={{ marginBottom: '0' }}>No GCash proof available</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Update Success Popup */}
          {updateSuccess && (
            <div className="popup-success">
              <h3 style={{ color: '#4caf50' }}>Update changed successfully!</h3>
            </div>
          )}

          {/* Handled Status Success Popup */}
          {handledSuccess && (
            <div className="popup-success">
              <h3 style={{ color: '#4caf50' }}>Customer attended successfully!</h3>
            </div>
          )}

          {/* Calendar/Time Picker Modal (for Ready to Check) */}
          {showCalendarModal && (
            <div className="orders-calendar-modal-bg" onClick={closeCalendarModal}>
              <div className="orders-calendar-modal-panel" onClick={e => e.stopPropagation()}>
                <div className="orders-calendar-modal-header">
                  <FaTimes className="orders-calendar-modal-exit" onClick={closeCalendarModal} />
                  <h2>Set Due Date and Time</h2>
                </div>
                <div className="orders-calendar-section">
                  <div className="orders-calendar-header">
                    <button className="orders-nav-btn" onClick={handleCalendarPrevMonth}><FaChevronLeft /></button>
                    <span>{currentMonthName} {calendarYear}</span>
                    <button className="orders-nav-btn" onClick={handleCalendarNextMonth}><FaChevronRight /></button>
                  </div>
                  <div className="orders-calendar-grid">
                    <div className="orders-calendar-days">
                      <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
                    </div>
                    <div className="orders-calendar-dates">
                      {calendarDays.map((day, idx) => {
                        let isToday = isCurrentMonth && day === todayDate;
                        let isPast = false;
                        if (day && (calendarYear < currentYear || (calendarYear === currentYear && (calendarMonth < currentMonth || (calendarMonth === currentMonth && day < todayDate))))) {
                          isPast = true;
                        }
                        return (
                          <div
                            key={idx}
                            className={`orders-calendar-date${!day ? ' empty' : ''}${isToday ? ' today' : ''}${isPast ? ' past' : ''}${selectedDay === day ? ' selected' : ''}`}
                            onClick={() => !isPast && day && setSelectedDay(day)}
                          >
                            {day && <span className="orders-date-number">{day}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {selectedDay && (
                  <div className="orders-time-picker-section">
                    <label htmlFor="orders-time-picker">Select Time:</label>
                    <select
                      id="orders-time-picker"
                      value={selectedTime}
                      onChange={e => setSelectedTime(e.target.value)}
                      className="orders-time-picker-input"
                    >
                      <option value="">Select a time</option>
                      {generateTimeSlots().map(time => (
                        <option 
                          key={time} 
                          value={time}
                          disabled={isTimeSlotBooked(time, 'check')}
                        >
                          {formatTimeToAMPM(time)} {isTimeSlotBooked(time, 'check') ? '(Already chosen)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  className="orders-set-date-btn"
                  onClick={handleSetDateTime}
                  disabled={!selectedDay || !selectedTime}
                >
                  Set Due Date and Time
                </button>
              </div>
            </div>
          )}

          {/* Completion Calendar Modal */}
          {showCompletionCalendar && (
            <div className="orders-calendar-modal-bg" onClick={closeCompletionCalendarModal}>
              <div className="orders-calendar-modal-panel" onClick={e => e.stopPropagation()}>
                <div className="orders-calendar-modal-header">
                  <FaTimes className="orders-calendar-modal-exit" onClick={closeCompletionCalendarModal} />
                  <h2>Set Completion Date and Time</h2>
                </div>
                <div className="orders-calendar-section">
                  <div className="orders-calendar-header">
                    <button className="orders-nav-btn" onClick={handleCompletionCalendarPrevMonth}><FaChevronLeft /></button>
                    <span>{monthNames[completionCalendarMonth]} {completionCalendarYear}</span>
                    <button className="orders-nav-btn" onClick={handleCompletionCalendarNextMonth}><FaChevronRight /></button>
                  </div>
                  <div className="orders-calendar-grid">
                    <div className="orders-calendar-days">
                      <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
                    </div>
                    <div className="orders-calendar-dates">
                      {calendarDays.map((day, idx) => {
                        const isToday = completionCalendarMonth === currentMonth && 
                                        completionCalendarYear === currentYear && 
                                        day === todayDate;
                        const isPast = day && (
                          completionCalendarYear < currentYear || 
                          (completionCalendarYear === currentYear && 
                          (completionCalendarMonth < currentMonth || 
                          (completionCalendarMonth === currentMonth && day < todayDate)))
                        );
                        
                        return (
                          <div
                            key={idx}
                            className={`orders-calendar-date${!day ? ' empty' : ''}${isToday ? ' today' : ''}${isPast ? ' past' : ''}${completionSelectedDay === day ? ' selected' : ''}`}
                            onClick={() => !isPast && day && setCompletionSelectedDay(day)}
                          >
                            {day && <span className="orders-date-number">{day}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {completionSelectedDay && (
                  <div className="orders-time-picker-section">
                    <label htmlFor="orders-completion-time-picker">Select Time:</label>
                    <select
                      id="orders-completion-time-picker"
                      value={completionSelectedTime}
                      onChange={e => setCompletionSelectedTime(e.target.value)}
                      className="orders-time-picker-input"
                    >
                      <option value="">Select a time</option>
                      {generateTimeSlots().map(time => (
                        <option 
                          key={time} 
                          value={time}
                          disabled={isTimeSlotBooked(time, 'pickup')}
                        >
                          {formatTimeToAMPM(time)} {isTimeSlotBooked(time, 'pickup') ? '(Already chosen)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  className="orders-set-date-btn"
                  onClick={handleSetCompletionDateTime}
                  disabled={!completionSelectedDay || !completionSelectedTime}
                >
                  Set Completion Date and Time
                </button>
              </div>
            </div>
          )}

          {/* Success Popup for Calendar Set */}
          {calendarSuccess && (
            <div className="orders-calendar-success-popup">
              <h3 style={{ color: '#4caf50', textAlign: 'center' }}>Successfully updated status!</h3>
            </div>
          )}

          {/* Payment Fee Modal */}
          {showPaymentModal && (
            <div className="dashboard-modal-bg animate-fade" onClick={() => setShowPaymentModal(false)}>
              <div className="dashboard-modal-panel animate-pop" style={{ maxWidth: 450, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: 16, textAlign: 'center' }}>Please provide the total payment fee for this order:</h3>
                {paymentOrderId && (() => {
                  const order = orders.find(o => o.id === paymentOrderId);
                  if (order?.pickup_appointment_date && order?.pickup_appointment_time) {
                    return (
                      <div style={{ width: '100%', padding: '12px', background: '#f0f9ff', border: '1px solid #3b82f6', borderRadius: 8, marginBottom: 16, textAlign: 'center' }}>
                        <div style={{ fontSize: 14, color: '#1e40af', fontWeight: 600, marginBottom: 4 }}>Selected Pickup Date & Time:</div>
                        <div style={{ fontSize: 16, color: '#1e3a8a', fontWeight: 700 }}>
                          {(() => {
                            const dateStr = order.pickup_appointment_date;
                            const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
                            if (dateMatch) {
                              const year = parseInt(dateMatch[1], 10);
                              const month = parseInt(dateMatch[2], 10) - 1;
                              const day = parseInt(dateMatch[3], 10);
                              const date = new Date(year, month, day);
                              return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                            }
                            return dateStr;
                          })()} at {formatTimeToAMPM(order.pickup_appointment_time)}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                <input
                  type="number"
                  min="0"
                  value={paymentFee}
                  onChange={e => setPaymentFee(e.target.value)}
                  style={{ width: '100%', padding: 10, fontSize: 18, marginBottom: 20, borderRadius: 6, border: '1px solid #ccc' }}
                  placeholder="Enter fee (₱)"
                />
                <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                  <button
                    className="modal-button"
                    style={{ flex: 1, fontSize: 16, background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                    onClick={handleBackToCalendar}
                  >
                    Back
                  </button>
                  <button
                    className="modal-button"
                    style={{ flex: 1, fontSize: 16, background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                    onClick={handlePaymentSubmit}
                    disabled={!paymentFee || isNaN(paymentFee) || Number(paymentFee) <= 0}
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Finish Confirmation Modal */}
          {showFinishConfirmation && orderToFinish && (
            <div className="dashboard-modal-bg animate-fade" onClick={() => { setShowFinishConfirmation(false); setOrderToFinish(null); }}>
              <div className="dashboard-modal-panel animate-pop" style={{ maxWidth: 400, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginBottom: 20, textAlign: 'center' }}>Are you sure the Order is Finished?</h3>
                <div style={{ display: 'flex', gap: 16, width: '100%' }}>
                  <button
                    className="modal-button"
                    style={{ flex: 1, fontSize: 16, background: '#6c757d', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                    onClick={() => {
                      setShowFinishConfirmation(false);
                      setOrderToFinish(null);
                    }}
                  >
                    No
                  </button>
                  <button
                    className="modal-button"
                    style={{ flex: 1, fontSize: 16, background: '#4caf50', color: '#fff', border: 'none', borderRadius: 6, padding: 12, cursor: 'pointer' }}
                    onClick={handleFinishOrder}
                  >
                    Yes
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Image Modal for Zoom */}
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

          {/* Refund Modal */}
          {showRefundModal && (
            <div className="dashboard-modal-bg animate-fade" onClick={() => {
              setShowRefundModal(false);
              setRefundImageFile(null);
              setRefundImagePreview(null);
            }}>
              <div className="dashboard-modal-panel animate-pop" style={{ maxWidth: 500, padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }} onClick={(e) => e.stopPropagation()}>
                <AiOutlineClose
                  className="dashboard-modal-exit-icon"
                  onClick={() => {
                    setShowRefundModal(false);
                    setRefundImageFile(null);
                    setRefundImagePreview(null);
                  }}
                  style={{ position: 'absolute', top: 16, right: 16, cursor: 'pointer' }}
                />
                <h3 style={{ marginBottom: 20, textAlign: 'center', marginTop: 10 }}>Process Refund</h3>
                <p style={{ marginBottom: 20, textAlign: 'center', color: '#666' }}>
                  Please upload a GCash refund image to process the refund for this cancelled order.
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
                      setShowRefundModal(false);
                      setRefundImageFile(null);
                      setRefundImagePreview(null);
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
          )}

          {/* Refund Success Popup */}
          {refundSuccess && (
            <div className="popup-success">
              <h3 style={{ color: '#4caf50' }}>Refund Processed Successfully!</h3>
            </div>
          )}
        </div>
      </div>
  );
};

export default Orders;