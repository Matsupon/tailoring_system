import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BookAppointment from '../../components/BookAppointment';
import Header from '../../components/Header';
import { useAppointmentModal } from '../../contexts/AppointmentModalContext';
import api from '../../utils/api';

export default function HomePage() {
  const [userFirstName, setUserFirstName] = useState('User');
  const router = useRouter();
  const { isOpen: modalVisible, closeModal } = useAppointmentModal();
  const [nextAppointment, setNextAppointment] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [details, setDetails] = useState(null);
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const headerRefreshFn = useRef(null);
  // Feedback prompt state
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [finishedVisible, setFinishedVisible] = useState(false);
  const [pendingFeedback, setPendingFeedback] = useState(null); // { order_id, service_type, completed_at }
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  // Image zoom modal states
  const [showImageZoomModal, setShowImageZoomModal] = useState(false);
  const [zoomedImageUri, setZoomedImageUri] = useState(null);
  const [zoomedImageTitle, setZoomedImageTitle] = useState('');

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await api.get('/user');
      const fullName = res?.data?.user?.name || '';
      const first = fullName.trim().split(/\s+/)[0] || 'User';
      setUserFirstName(first);
    } catch (_) {
      setUserFirstName('User');
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        const list = (res.data.data || []);
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setNotifications(list);
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        // Token expired or invalid - redirect to login
        try {
          await AsyncStorage.removeItem('authToken');
          router.replace('/auth/login');
        } catch (storageError) {
          // Error during logout
        }
      }
    }
  }, [router]);

  const loadLatestOrder = useCallback(async () => {
    try {
      setOrderLoading(true);
      const res = await api.get('/me/orders');
      if (res.data?.success) {
        const ordersData = res.data.data || [];
        setOrders(ordersData);
      }
    } catch (e) {
      // Don't set orders to empty on error, keep previous value
    } finally {
      setOrderLoading(false);
    }
  }, []);

  // Check if there is a finished order without feedback
  const loadPendingFeedback = useCallback(async () => {
    try {
      const res = await api.get('/feedback/my-pending');
      if (res.data?.success && res.data.data) {
        setPendingFeedback(res.data.data);
        setFeedbackRating(0);
        setFeedbackComment('');
        // First show the congratulations modal, only then show feedback modal
        setFinishedVisible(true);
      } else {
        setPendingFeedback(null);
        setFeedbackVisible(false);
        setFinishedVisible(false);
      }
    } catch (e) {
      // silent
    }
  }, []);

  const loadNextAppointment = useCallback(async () => {
    try {
      // For multiple orders, we'll get the next appointment from the first order
      // This can be enhanced later to show next appointment for each order
      const res = await api.get('/appointments/next-appointment');
      const data = res.data;

      if (data?.appointment_date && data?.appointment_time) {
        const iso = `${data.appointment_date}T${data.appointment_time}`;
        const dateTime = new Date(iso);

        if (!isNaN(dateTime.getTime())) {
          setNextAppointment(formatDateTime12(dateTime));
        } else {
          setNextAppointment(null);
        }
      } else {
        setNextAppointment(null);
      }
    } catch (err) {
      // Only log if it's not a 404 or network error
      if (err?.response?.status === 404) {
        // 404 is expected if no appointment exists
        setNextAppointment(null);
      } else if (err.response) {
        // Server responded with an error
        setNextAppointment(null);
      } else if (err.code !== 'NETWORK_ERROR' && err.message !== 'Network Error') {
        // Other errors (but not network errors)
        setNextAppointment(null);
      }
      // Don't set to null on network errors, keep previous value if available
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    loadCurrentUser();
    loadLatestOrder();
    loadNextAppointment();
    // Also check for pending feedback (in case there is no active order)
    loadPendingFeedback();
    // load last seen timestamp for notifications
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('notifications_last_seen_at');
        if (saved) setLastSeenAt(saved);
      } catch (_) {}
    })();
  }, [loadNotifications, loadCurrentUser, loadLatestOrder, loadNextAppointment, loadPendingFeedback]);

  // Sync lastSeenAt with AsyncStorage changes (when Header marks notifications as seen)
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const saved = await AsyncStorage.getItem('notifications_last_seen_at');
        if (saved !== lastSeenAt) {
          // lastSeenAt changed, update state to sync NEW badge
          setLastSeenAt(saved);
        }
      } catch (error) {
        // Silently fail - AsyncStorage errors are rare
      }
    }, 1000); // Check every 1 second for sync

    return () => clearInterval(syncInterval);
  }, [lastSeenAt]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadNotifications(), loadLatestOrder(), loadNextAppointment(), loadPendingFeedback()]);
    setRefreshing(false);
  }, [loadNotifications, loadLatestOrder, loadNextAppointment, loadPendingFeedback]);

  const formatMonthDay = (iso) => {
    const d = new Date(iso);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${mm}/${dd}`;
  };

  const formatTime12 = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateTime12 = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Invalid date";  
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${mm}/${dd}/${yyyy} ${time}`;
  };

  const formatTo12Hour = (time24) => {
    const [hour, minute] = time24.split(':');
    const hourNum = parseInt(hour);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum % 12 || 12;
    return `${hour12}:${minute} ${period}`;
  };

  const handleImageClick = (imageUri, title) => {
    setZoomedImageUri(imageUri);
    setZoomedImageTitle(title);
    setShowImageZoomModal(true);
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const hourStr = hour < 10 ? `0${hour}` : `${hour}`;
        const minuteStr = minute < 10 ? `0${minute}` : `${minute}`;
        const time = `${hourStr}:${minuteStr}`;
        if (time !== '12:00' && time !== '12:30') {
          slots.push(time);
        }
      }
    }
    return slots;
  };


  const parseSizesToText = (sizes) => {
    try {
      let obj = sizes;
      if (!obj) return '';
      if (typeof obj === 'string') {
        obj = JSON.parse(obj);
      }
      if (Array.isArray(obj)) {
        return obj.join(', ');
      }
      if (obj && typeof obj === 'object') {
        return Object.entries(obj)
          .filter(([, qty]) => Number(qty) > 0)
          .map(([size, qty]) => `${size} - ${qty} pcs.`)
          .join('\n');
      }
      return '';
    } catch (_) {
      return '';
    }
  };

  const openDetails = (n) => {
    if (n.type === 'appointment_booked') {
      setDetails({
        type: 'appointment_booked',
        title: 'You have successfully booked an appointment!',
        message: n.body || 'Please wait while the admin reviews your appointment request. Your order will be processed once it has been approved. In the meantime, you can check your submitted appointment at the "My Profile" page under the "My Appointments" section.',
      });
      setDetailsVisible(true);
      return;
    }

    if (n.type === 'ready_to_check') {
      setDetails({
        type: 'ready_to_check',
        title: 'Your order is now ready to check',
        scheduled_at: n.data?.scheduled_at || null,
      });
      setDetailsVisible(true);
      return;
    }

    if (n.type === 'order_finished') {
      setDetails({
        type: 'order_finished',
        title: 'Congratulations! Your order is now finished!',
        message: 'Please go to the \'My Orders\' page and under the \'Order History\' section to check your finished order!',
      });
      setDetailsVisible(true);
      return;
    }

    if (n.type === 'feedback_responded') {
      const title = 'Admin responded to your feedback';
      const body = n.body || n.data?.admin_response || (n.data?.admin_checked ? 'The admin has reviewed your feedback.' : '');
      setDetails({ type: 'feedback_responded', title, body });
      setDetailsVisible(true);
      return;
    }

    if (n.type === 'order_completed') {
      setDetails({
        type: 'order_completed',
        title: 'Your order is now completed',
        scheduled_at: n.data?.scheduled_at || null,
        amount: n.data?.total_amount != null ? Number(n.data.total_amount) : null,
      });
      setDetailsVisible(true);
      return;
    }

    if (n.type === 'order_details_updated') {
      setDetails({
        type: 'order_details_updated',
        title: 'You have successfully rescheduled your appointment!',
        message: '',
      });
      setDetailsVisible(true);
      return;
    }

    if (n.type === 'order_cancelled') {
      setDetails({
        type: 'order_cancelled',
        title: 'You have successfully cancelled an order!',
        message: 'Please wait while the admin processes your refund.',
      });
      setDetailsVisible(true);
      return;
    }

    if (n.type === 'refund_processed') {
      setDetails({
        type: 'refund_processed',
        title: n.title || 'Your down payment for the cancelled appointment/order has been successfully refunded by the admin. Please go to the "Appointments" page to check your refund status.',
      });
      setDetailsVisible(true);
      return;
    }

    setDetails({
      type: 'generic',
      title: n.title,
      body: n.body ?? '',
    });
    setDetailsVisible(true);
  };

  const renderActivityItem = (n) => {
    const isReadyToCheck = n.type === 'ready_to_check';
    const isOrderCompleted = n.type === 'order_completed';
    const isOrderFinished = n.type === 'order_finished';
    const isFeedbackResponded = n.type === 'feedback_responded';
    const isAppointmentRejected = n.type === 'appointment_rejected';
    const isAppointmentBooked = n.type === 'appointment_booked';
    const isOrderDetailsUpdated = n.type === 'order_details_updated';
    const isOrderCancelled = n.type === 'order_cancelled';
    const isRefundProcessed = n.type === 'refund_processed';
    const showViewMore = isReadyToCheck || isOrderCompleted || isAppointmentRejected || isFeedbackResponded || isOrderFinished || isAppointmentBooked || isOrderDetailsUpdated || isOrderCancelled || isRefundProcessed;
    const title = isReadyToCheck
      ? 'Your order is now ready to check'
      : isOrderCompleted
      ? 'Your order is now completed'
      : isOrderFinished
      ? 'Your order is now finished'
      : isFeedbackResponded
      ? 'Admin responded to your feedback'
      : isAppointmentBooked
      ? 'You have successfully booked an appointment!'
      : isOrderDetailsUpdated
      ? 'You have successfully updated your Order Details!'
      : isOrderCancelled
      ? 'You have successfully cancelled an order!'
      : isRefundProcessed
      ? 'Your down payment for the cancelled appointment/order has been successfully refunded by the admin.'
      : n.title;
    const isUnread = !lastSeenAt || new Date(n.created_at).getTime() > new Date(lastSeenAt).getTime();
    return (
      <View key={n.id} style={styles.activityItem}>
        {isUnread && (
          <View style={styles.newPill}>
            <Text style={styles.newPillText}>NEW</Text>
          </View>
        )}
        <Text style={styles.activityDate}>{formatMonthDay(n.created_at)}</Text>
        <View style={styles.activityContent}>
          <Text style={styles.activityText}>{title}</Text>
          {isAppointmentBooked && n.body && (
            <Text style={styles.activitySubtext}>{n.body}</Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.activityTime}>{formatTime12(n.created_at)}</Text>
            {showViewMore && (
              <TouchableOpacity onPress={() => openDetails(n)} style={{ marginLeft: 12 }}>
                <Text style={styles.viewMore}>View More</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.background} />
      <Header
        userName={userFirstName}
        onRef={(fn) => { headerRefreshFn.current = fn; }}
        onNotificationsViewed={async () => {
          try {
            const saved = await AsyncStorage.getItem('notifications_last_seen_at');
            if (saved) {
              setLastSeenAt(saved);
            } else {
              const now = new Date().toISOString();
              await AsyncStorage.setItem('notifications_last_seen_at', now);
              setLastSeenAt(now);
            }
          } catch (_) {}
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeText}>Greetings, {userFirstName}!</Text>
          <Text style={styles.welcomeSubtext}>
            "We're tailoring your orders with care.{'\n'}Here's what's happening today."
          </Text>
        </View>

        {orders.length > 0 ? (
          orders.map((order) => (
            <View key={order.id}>
              <Text style={[styles.sectionTitle, { marginTop: orders.indexOf(order) === 0 ? 0 : 20, marginBottom: 10 }]}>
                Order #{order.id}
                {order.queue_number ? ` - Queue #${order.queue_number}` : ''}
              </Text>
              <View style={styles.orderCard}>
                <View style={styles.orderTitleContainer}>
                  <Text style={styles.orderTitle}>
                    <Text style={styles.boldText}>Current Order</Text>
                  </Text>
                </View>
                <View style={styles.orderDetails}>
                  <View style={styles.orderInfo}>
                    <Text style={styles.itemText}>
                      {order?.appointment?.service_type || 'N/A'}
                    </Text>
                    <View style={styles.sizeDetails}>
                      <Text style={styles.sizeLabel}>Size:</Text>
                      <Text style={styles.sizeText}>
                        {parseSizesToText(order?.appointment?.sizes) || 'N/A'}
                      </Text>
                    </View>
                    <Text style={styles.itemDetail}>
                      {`Quantity: ${order?.appointment?.total_quantity ?? 'N/A'} pcs.`}
                    </Text>
                  </View>
                  <View style={styles.dateSection}>
                    <Text style={styles.dateLabel}>Due Date</Text>
                    <Text style={styles.date}>
                      {order?.appointment?.preferred_due_date
                        ? new Date(order.appointment.preferred_due_date).toLocaleDateString()
                        : 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.orderProgressContainer}>
                  <View style={styles.progressBar}>
                    {['Pending', 'Ready to Check', 'Completed'].map((step, idx) => {
                      const status = order?.status || 'Pending';
                      const activeIdx =
                        status === 'Pending' ? 0 : status === 'Ready to Check' ? 1 : 2;
                      const isActive = idx === activeIdx;
                      
                      // Determine the color based on which step is active
                      let activeStyle = styles.stepCurrent; // default green
                      if (isActive) {
                        if (idx === 0) activeStyle = styles.stepOrange; // Pending
                        else if (idx === 1) activeStyle = styles.stepRed; // Ready to Check
                        else activeStyle = styles.stepCurrent; // Completed (green)
                      }
                      
                      return (
                        <View
                          key={step}
                          style={[
                            styles.progressStep,
                            isActive ? activeStyle : styles.stepDone,
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.progressText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    Pending → Ready to Check → Completed
                  </Text>
                </View>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.orderCard}>
            <Text style={styles.orderTitle}>
              <Text style={styles.boldText}>You have no orders yet</Text>
            </Text>
            <Text style={{ color: '#687076' }}>
              Press on the blue button at the bottom right to book an appointment!
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Announcements</Text>

        {orders.length > 0 ? (
          orders.map((order) => {
            // Determine next appointment based on order status
            let nextAppt = null;
            if (order.status !== 'Finished') {
              if (order.status === 'Ready to Check' && order.check_appointment_date && order.check_appointment_time) {
                // For Ready to Check: use check appointment
                const checkDateTime = new Date(`${order.check_appointment_date}T${order.check_appointment_time}`);
                if (!isNaN(checkDateTime.getTime())) {
                  nextAppt = formatDateTime12(checkDateTime);
                }
              } else if (order.status === 'Completed' && order.pickup_appointment_date && order.pickup_appointment_time) {
                // For Completed: use pickup appointment
                const pickupDateTime = new Date(`${order.pickup_appointment_date}T${order.pickup_appointment_time}`);
                if (!isNaN(pickupDateTime.getTime())) {
                  nextAppt = formatDateTime12(pickupDateTime);
                }
              } else if (order?.appointment?.appointment_date && order?.appointment?.appointment_time) {
                // For Pending or fallback: use initial appointment
                const apptDateTime = new Date(`${order.appointment.appointment_date}T${order.appointment.appointment_time}`);
                if (!isNaN(apptDateTime.getTime())) {
                  nextAppt = formatDateTime12(apptDateTime);
                }
              }
            }

            return (
              <View key={order.id}>
                <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: orders.indexOf(order) === 0 ? 0 : 20, marginBottom: 10 }]}>
                  Order #{order.id}
                </Text>
                <View style={styles.announcementCard}>
                  <View style={[styles.indicator, styles.indicatorGreen]} />
                  <MaterialIcons
                    name="access-time"
                    size={24}
                    color="#16A34A"
                    style={styles.announcementIcon}
                  />
                  <View>
                    <Text style={styles.announcementTitle}>Next Appointment</Text>
                    <Text style={styles.announcementDate}>
                      {nextAppt || 'No recent appointment for now'}
                    </Text>
                  </View>
                </View>

                <View style={styles.announcementCard}>
                  <View style={[styles.indicator, styles.indicatorYellow]} />
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={24}
                    color="#FFA500"
                    style={styles.announcementIcon}
                  />
                  <View>
                    <Text style={styles.announcementTitle}>Order Status</Text>
                    {order.status !== 'Finished' && order?.status ? (
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor:
                              order?.status === 'Completed'
                                ? '#E8F5E9'
                                : order?.status === 'Ready to Check'
                                ? '#FFE3D6'
                                : '#FFF5CC',
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color:
                              order?.status === 'Completed'
                                ? '#2e7d32'
                                : order?.status === 'Ready to Check'
                                ? '#b23c17'
                                : '#7a5f00',
                            fontSize: 12,
                            fontWeight: '500',
                          }}
                        >
                          {order?.status}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.announcementDate}>No recent status for now</Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <>
            <View style={styles.announcementCard}>
              <View style={[styles.indicator, styles.indicatorGreen]} />
              <MaterialIcons
                name="access-time"
                size={24}
                color="#16A34A"
                style={styles.announcementIcon}
              />
              <View>
                <Text style={styles.announcementTitle}>Next Appointment</Text>
                <Text style={styles.announcementDate}>No recent appointment for now</Text>
              </View>
            </View>

            <View style={styles.announcementCard}>
              <View style={[styles.indicator, styles.indicatorYellow]} />
              <MaterialCommunityIcons
                name="file-document-outline"
                size={24}
                color="#FFA500"
                style={styles.announcementIcon}
              />
              <View>
                <Text style={styles.announcementTitle}>Order Status</Text>
                <Text style={styles.announcementDate}>No recent status for now</Text>
              </View>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Recent Activity</Text>

        <View style={styles.activityList}>
          {notifications.length === 0 ? (
            <Text style={{ color: '#687076', padding: 10 }}>No new notifications for now.</Text>
          ) : (
            notifications.map(renderActivityItem)
          )}
        </View>
      </ScrollView>

      <BookAppointment visible={modalVisible} onClose={closeModal} />

      {/* Details Modal */}
      <Modal
        visible={detailsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{details?.title || 'Details'}</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <MaterialIcons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={true}>
            {(() => {
              if (!details) return <Text style={styles.modalBody}>Please check the "My Orders" page under the History section to review your feedback and check for admin response!</Text>;
              if (details.type === 'appointment_booked') {
                return (
                  <View>
                    <Text style={[styles.modalBody, { fontSize: 15, color: '#16A34A', fontWeight: '600', lineHeight: 22 }]}>{details.message}</Text>
                  </View>
                );
              }
              if (details.type === 'order_completed') {
                return (
                  <View>
                    {details.scheduled_at && (
                      <Text style={[styles.modalBody, { color: '#1e88e5', fontSize: 16, fontWeight: '600' }]}>Next appointment: {formatDateTime12(details.scheduled_at)}</Text>
                    )}
                    {details.amount != null && (
                      <Text style={[styles.modalBody, { color: '#16A34A', fontSize: 18, fontWeight: '700', marginTop: 6 }]}>Please prepare ₱{details.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    )}
                  </View>
                );
              }
              if (details.type === 'ready_to_check') {
                return (
                  <View>
                    {details.scheduled_at && (
                      <Text style={[styles.modalBody, { color: '#1e88e5', fontSize: 16, fontWeight: '600' }]}>Next appointment: {formatDateTime12(details.scheduled_at)}</Text>
                    )}
                  </View>
                );
              }
              if (details.type === 'order_finished') {
                return (
                  <Text style={[styles.modalBody, { fontSize: 16 }]}>{details.message}</Text>
                );
              }
              if (details.type === 'order_details_updated') {
                return (
                  <Text style={[styles.modalBody, { fontSize: 16, color: '#16A34A', fontWeight: '600' }]}>{details.message}</Text>
                );
              }
              if (details.type === 'order_cancelled') {
                return (
                  <Text style={[styles.modalBody, { fontSize: 16, color: '#16A34A', fontWeight: '600' }]}>{details.message || ''}</Text>
                );
              }
              if (details.type === 'refund_processed') {
                return (
                  <View>
                    <Text style={[styles.modalBody, { fontSize: 15, color: '#16A34A', fontWeight: '600', marginBottom: 12, lineHeight: 22 }]}>
                      {details.title}
                    </Text>
                    {details.refund_image && (
                      <View style={{ marginTop: 12 }}>
                        <Text style={[styles.modalBody, { fontSize: 14, color: '#666', marginBottom: 8 }]}>
                          GCash Refund Proof:
                        </Text>
                        <TouchableOpacity
                          onPress={() => handleImageClick(details.refund_image, 'GCash Refund Proof')}
                          style={{ position: 'relative' }}
                        >
                          <Image
                            source={{ uri: details.refund_image }}
                            style={{ width: '100%', height: 200, borderRadius: 8, resizeMode: 'contain' }}
                          />
                          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 8, justifyContent: 'center', alignItems: 'center' }}>
                            <MaterialIcons name="zoom-in" size={24} color="#fff" />
                            <Text style={{ color: '#fff', marginTop: 4, fontSize: 12 }}>Tap to zoom</Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              }
              if (details.type === 'feedback_responded' || details.type === 'generic') {
                return (
                  <Text style={[styles.modalBody, { fontSize: 16 }]}>{details.body || 'No additional information.'}</Text>
                );
              }
              return <Text style={styles.modalBody}>No additional information.</Text>;
            })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Finished Order Modal (shown before Feedback) */}
      <Modal
        visible={finishedVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setFinishedVisible(false);
          setFeedbackVisible(true);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Congratulations! Your order is now finished!</Text>
              <TouchableOpacity
                onPress={() => {
                  setFinishedVisible(false);
                  setFeedbackVisible(true);
                }}
              >
                <MaterialIcons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalBody}>
              Please check through the "My Orders" page under the History section to view your completed order
            </Text>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        visible={feedbackVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedbackVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Rate your experience</Text>
              <TouchableOpacity onPress={() => setFeedbackVisible(false)}>
                <MaterialIcons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            {pendingFeedback ? (
              <Text style={styles.modalBody}>
                {`Order: ${pendingFeedback.service_type || 'N/A'}`}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 10 }}>
              {[1,2,3,4,5].map((v) => (
                <TouchableOpacity key={v} onPress={() => setFeedbackRating(v)} style={{ marginHorizontal: 6 }}>
                  <MaterialIcons
                    name={v <= feedbackRating ? 'star' : 'star-border'}
                    size={30}
                    color={v <= feedbackRating ? '#f5a623' : '#ccc'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              multiline
              placeholder="Optional comment"
              placeholderTextColor="#999"
              value={feedbackComment}
              onChangeText={setFeedbackComment}
              style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, minHeight: 80, color: '#000' }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
              <View style={{ padding: 10 }} />
              <TouchableOpacity
                disabled={feedbackRating === 0 || feedbackSubmitting || !pendingFeedback}
                onPress={async () => {
                  if (!pendingFeedback) return;
                  try {
                    setFeedbackSubmitting(true);
                    await api.post('/feedback', {
                      order_id: pendingFeedback.order_id,
                      rating: feedbackRating,
                      comment: feedbackComment || undefined,
                    });
                    setFeedbackVisible(false);
                    setPendingFeedback(null);
                    setFeedbackSuccess(true);
                    setTimeout(() => setFeedbackSuccess(false), 3000);
                  } catch (e) {
                    alert('Failed to submit feedback');
                  } finally {
                    setFeedbackSubmitting(false);
                  }
                }}
                style={{ backgroundColor: feedbackRating === 0 ? '#ccc' : '#4682B4', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>{feedbackSubmitting ? 'Submitting...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {feedbackSuccess && (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 90, backgroundColor: '#E8F5E9', borderRadius: 12, padding: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}>
          <Text style={{ color: '#16A34A', fontWeight: '700' }}>Feedback sent successfully!</Text>
        </View>
      )}

      {/* Image Zoom Modal */}
      <Modal
        visible={showImageZoomModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageZoomModal(false)}
      >
        <View style={styles.imageZoomBackdrop}>
          <TouchableOpacity
            style={styles.imageZoomCloseButton}
            onPress={() => setShowImageZoomModal(false)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <View style={styles.imageZoomContainer}>
            <Text style={styles.imageZoomTitle}>{zoomedImageTitle}</Text>
            <ScrollView
              contentContainerStyle={styles.imageZoomScrollContent}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bounces={true}
            >
              {zoomedImageUri && (
                <Image
                  source={{ uri: zoomedImageUri }}
                  style={styles.zoomedImage}
                  resizeMode="contain"
                />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: '#e0f4ff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 20,
  },
  welcomeSection: {
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#687076',
    marginTop: 5,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    marginTop: 10,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  orderInfo: {
    flex: 1,
    marginRight: 10,
  },
  sizeDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 5,
  },
  sizeLabel: {
    fontSize: 14,
    color: '#687076',
    marginRight: 5,
  },
  sizeText: {
    fontSize: 14,
    color: '#687076',
    flex: 1,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#000',
  },
  orderTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 13,
  },
  orderTitle: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  itemText: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#000',
    marginBottom: 5,
  },
  itemDetail: {
    fontSize: 14,
    color: '#687076',
  },
  dateSection: {
    alignItems: 'flex-end',
    minWidth: 100,
  },
  dateLabel: {
    fontSize: 13,
    color: '#000',
    marginBottom: 2,
  },
  date: {
    fontSize: 14,
    color: '#000',
    fontWeight: '500',
  },
  orderProgressContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
  },
  progressStep: {
    width: 16,
    height: 8,
    borderRadius: 4,
  },
  stepDone: {
    backgroundColor: '#A9A9A9',
  },
  stepCurrent: {
    backgroundColor: '#2E8B57', // Green for Completed
  },
  stepOrange: {
    backgroundColor: '#FFE082', // Pastel yellow for Pending
  },
  stepRed: {
    backgroundColor: '#FFAB91', // Pastel orange for Ready to Check
  },
  stepPending: {
    backgroundColor: '#A9A9A9',
  },
  progressText: {
    fontSize: 12,
    color: '#687076',
    textAlign: 'right',
    flexShrink: 1,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    marginTop: 20,
  },
  announcementCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 15,
  },
  indicatorGreen: {
    backgroundColor: '#16A34A',
  },
  indicatorYellow: {
    backgroundColor: '#FFA500',
  },
  announcementIcon: {
    marginRight: 15,
  },
  announcementTitle: {
    fontSize: 16,
    color: '#000',
    marginBottom: 2,
  },
  announcementDate: {
    fontSize: 14,
    color: '#687076',
  },
  statusBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    color: '#FFA500',
    fontSize: 12,
    fontWeight: '500',
  },
  activityList: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  activityItem: {
    flexDirection: 'row',
    marginBottom: 15,
    borderLeftWidth: 2,
    borderLeftColor: '#4682B4',
    paddingLeft: 15,
    position: 'relative',
  },
  activityDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginRight: 15,
    width: 45,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#000',
    marginBottom: 2,
  },
  activitySubtext: {
    fontSize: 12,
    color: '#687076',
    marginBottom: 4,
    lineHeight: 16,
  },
  activityTime: {
    fontSize: 12,
    color: '#687076',
  },
  newPill: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#16A34A',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 5,
  },
  newPillText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  viewMore: {
    color: '#4682B4',
    fontSize: 12,
    fontWeight: '500',
  },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { width: '88%', backgroundColor: '#fff', borderRadius: 14, paddingTop: 22, paddingHorizontal: 22, paddingBottom: 12, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  modalBody: { fontSize: 17, color: '#000', lineHeight: 24, marginTop: 6 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#687076',
    flex: 1,
    textAlign: 'right',
  },
  editButton: {
    backgroundColor: '#4682B4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  dateInputText: {
    fontSize: 14,
    color: '#000',
    flex: 1,
  },
  timeDropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 4,
    marginBottom: 8,
    maxHeight: 200,
  },
  timeDropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unavailableSlot: {
    backgroundColor: '#f8f8f8',
    opacity: 0.7,
  },
  editSectionLabel: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 6,
    marginTop: 10,
  },
  editInputField: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 8,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  editInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    height: 52,
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  editDropdownMenu: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 6,
    marginTop: -2,
    overflow: 'hidden',
    maxHeight: 200,
  },
  editDropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  editUnavailableSlot: {
    backgroundColor: '#f8f8f8',
    opacity: 0.7,
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    elevation: 9999,
  },
  successMessage: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    minWidth: 250,
  },
  successText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#16A34A',
    textAlign: 'center',
  },
  // Image Zoom Modal Styles
  imageZoomBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageZoomCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 10,
  },
  imageZoomContainer: {
    flex: 1,
    width: '100%',
    paddingTop: 80,
    paddingBottom: 20,
  },
  imageZoomTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  imageZoomScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  zoomedImage: {
    width: '100%',
    minHeight: 400,
    maxWidth: '100%',
  },
});