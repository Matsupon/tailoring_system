import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Header from '../../components/Header';
import api from '../../utils/api';

// Profanity filter function
const filterProfanity = (text) => {
  if (!text) return text;
  const profanityWords = ['shit', 'fuck', 'die', 'kill', 'jawa', 'piste', 'yati', 'jati', 'motherfucker'];
  let filteredText = text;
  profanityWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filteredText = filteredText.replace(regex, '*'.repeat(word.length));
  });
  return filteredText;
};

// Filter profanity from order data recursively
const filterOrderData = (order) => {
  if (!order) return order;
  
  const filtered = { ...order };
  
  // Filter appointment notes
  if (filtered.appointment?.notes) {
    filtered.appointment = {
      ...filtered.appointment,
      notes: filterProfanity(filtered.appointment.notes)
    };
  }
  
  // Filter feedback comment and admin response
  if (filtered.feedback) {
    filtered.feedback = {
      ...filtered.feedback,
      comment: filtered.feedback.comment ? filterProfanity(filtered.feedback.comment) : filtered.feedback.comment,
      admin_response: filtered.feedback.admin_response ? filterProfanity(filtered.feedback.admin_response) : filtered.feedback.admin_response
    };
  }
  
  return filtered;
};

export default function OrdersPage() {
  const [expandedRecent, setExpandedRecent] = useState(null); // Changed to store order ID
  const [expandedHistory, setExpandedHistory] = useState({
    first: false,
    second: false,
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [latestOrder, setLatestOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [finishedOrders, setFinishedOrders] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const toggleRecent = (orderId) => {
    setExpandedRecent(expandedRecent === orderId ? null : orderId);
  };

  const toggleHistory = (key) => {
    setExpandedHistory((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleImagePress = (imageSource) => {
    setSelectedImage(imageSource);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedImage(null);
  };

  const formatDateTime12 = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Invalid date';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${mm}/${dd}/${yyyy} ${time}`;
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

  const loadNextAppointment = useCallback(async () => {
    try {
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
      setNextAppointment(null);
    }
  }, []);

  const loadLatestOrder = useCallback(async () => {
    try {
      setOrderLoading(true);
      const res = await api.get('/me/orders');
      if (res.data?.success) {
        const ordersData = res.data.data || [];
        // Filter profanity from all orders
        const filteredOrders = ordersData.map(order => filterOrderData(order));
        setOrders(filteredOrders);
        // Set latestOrder to the first order for backward compatibility
        setLatestOrder(filteredOrders.length > 0 ? filteredOrders[0] : null);
      }
    } catch (e) {
    } finally {
      setOrderLoading(false);
    }
  }, []);

  const loadFinishedOrders = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await api.get('/me/orders/history');
      if (res.data?.success) {
        const ordersData = res.data.data || [];
        // Filter profanity from all finished orders
        const filteredOrders = ordersData.map(order => filterOrderData(order));
        setFinishedOrders(filteredOrders);
      }
    } catch (e) {
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNextAppointment();
    loadLatestOrder();
    loadFinishedOrders();
  }, [loadNextAppointment, loadLatestOrder, loadFinishedOrders]);

  // Periodically refresh finished orders to reflect admin responses in near real-time
  useEffect(() => {
    const id = setInterval(() => {
      loadFinishedOrders();
    }, 10000);
    return () => clearInterval(id);
  }, [loadFinishedOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadNextAppointment(),
      loadLatestOrder(),
      loadFinishedOrders(),
    ]);
    setRefreshing(false);
  }, [loadNextAppointment, loadLatestOrder, loadFinishedOrders]);

  const getStatusColor = (status) => {
    switch(status) {
      case 'Completed':
        return '#4caf50';
      case 'Ready to Check':
        return '#FFAB91';
      case 'Pending':
      default:
        return '#FFE082';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.background} />
      <Header
        userName="Dianne"
        onNotificationsViewed={async () => {
          try {
            const saved = await AsyncStorage.getItem('notifications_last_seen_at');
            if (!saved) {
              const now = new Date().toISOString();
              await AsyncStorage.setItem('notifications_last_seen_at', now);
            }
          } catch (_) {}
        }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ paddingBottom: 50 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.pageTitle}>My Orders</Text>

        {/* Reminders Section */}
        <Text style={styles.sectionTitle}>Reminders</Text>
        <View style={styles.reminderCard}>
          <View style={[styles.indicator, styles.indicatorGreen]} />
          <MaterialIcons name="access-time" size={24} color="#16A34A" style={styles.icon} />
          <View>
            <Text style={styles.cardTitle}>Next Appointment</Text>
            <Text style={styles.cardDate}>{nextAppointment ? nextAppointment : 'No appointment set for now'}</Text>
          </View>
        </View>

        {/* Recent Section */}
        <Text style={styles.sectionTitle}>Recent</Text>
        {orders.length > 0 ? (
          orders.map((order, orderIndex) => {
            const isExpanded = expandedRecent === order.id;
            return (
              <View key={order.id} style={{ marginBottom: orderIndex < orders.length - 1 ? 15 : 0 }}>
                <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: orderIndex === 0 ? 0 : 15, marginBottom: 10 }]}>
                  Order #{order.id}
                  {order.queue_number ? ` - Queue #${order.queue_number}` : ''}
                </Text>
                <View style={styles.appointmentCard}>
                  <View style={[styles.indicator, {backgroundColor: getStatusColor(order?.status || 'Pending')}]} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.orderInfo}>
                        <Text style={styles.cardDate} numberOfLines={1} ellipsizeMode="tail">
                          {`Order: ${order?.appointment?.service_type || 'N/A'}`}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleRecent(order.id)} style={styles.statusContainer}>
                        {order?.status ? (
                          <Text
                            style={[
                              styles.statusText,
                              order?.status === 'Completed'
                                ? styles.statusCompleted
                                : order?.status === 'Ready to Check'
                                ? styles.statusReadyToCheck
                                : styles.statusPending,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {order?.status}
                          </Text>
                        ) : (
                          <Text style={[styles.statusText, styles.statusPending]} numberOfLines={1} ellipsizeMode="tail">Pending</Text>
                        )}
                        <MaterialIcons
                          name={isExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                          size={24}
                          color={getStatusColor(order?.status || 'Pending')}
                        />
                      </TouchableOpacity>
                    </View>
                    {isExpanded && (
                      <View style={styles.dropdownContent}>
                        <Text style={styles.dropdownTitle}>Order Details:</Text>
                        <Text style={styles.dropdownText}>{`• Service: ${order?.appointment?.service_type || 'N/A'}`}</Text>
                        <Text style={styles.dropdownText}>{`• Phone Number: ${order?.appointment?.user?.phone || 'N/A'}`}</Text>
                        <Text style={styles.dropdownText}>{`• Size: ${parseSizesToText(order?.appointment?.sizes) || 'N/A'}`}</Text>
                        <Text style={styles.dropdownText}>{`• Quantity: ${order?.appointment?.total_quantity ?? 'N/A'} pcs.`}</Text>
                        <Text style={styles.dropdownText}>{`• Due Date: ${
                          order?.appointment?.preferred_due_date
                            ? new Date(order.appointment.preferred_due_date).toLocaleDateString()
                            : 'N/A'
                        }`}</Text>
                        <Text style={styles.dropdownText}>{`• Notes: ${order?.appointment?.notes || 'N/A'}`}</Text>
                        <Text style={styles.dropdownText}>• Design Image:</Text>
                        {order?.appointment?.design_image ? (
                          <TouchableOpacity onPress={() => handleImagePress({ uri: order.appointment.design_image })}>
                            <Image source={{ uri: order.appointment.design_image }} style={styles.image} />
                          </TouchableOpacity>
                        ) : null}
                        <Text style={styles.dropdownText}>• Gcash Downpayment:</Text>
                        {order?.appointment?.gcash_proof ? (
                          <TouchableOpacity onPress={() => handleImagePress({ uri: order.appointment.gcash_proof })}>
                            <Image source={{ uri: order.appointment.gcash_proof }} style={styles.image} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.appointmentCard}>
            <View style={[styles.indicator, {backgroundColor: getStatusColor('Pending')}]} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>No recent orders for now</Text>
              </View>
            </View>
          </View>
        )}

       {/* History Section */}
      <Text style={styles.sectionTitle}>History</Text>

{finishedOrders.length > 0 ? (
  finishedOrders.map((order, index) => (
    <View key={order.id} style={styles.appointmentCard}>
      <View style={[styles.indicator, styles.indicatorCompleted]} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.cardDate} numberOfLines={2}>
              {`Order: ${order?.appointment?.service_type || 'N/A'}`}
            </Text>
          </View>
          <TouchableOpacity 
            onPress={() => toggleHistory(index.toString())} 
            style={styles.statusContainer}
          >
            <Text style={[styles.statusText, styles.statusCompleted]}></Text>
            <MaterialIcons
              name={expandedHistory[index.toString()] ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={24}
              color="#4caf50"
            />
          </TouchableOpacity>
                </View>
                {expandedHistory[index.toString()] && (
                  <View style={styles.dropdownContent}>
                    <Text style={styles.dropdownTitle}>Order Details:</Text>
                    <Text style={styles.dropdownText}>{`• Service: ${order?.appointment?.service_type || 'N/A'}`}</Text>
                    <Text style={styles.dropdownText}>{`• Phone Number: ${order?.appointment?.user?.phone || 'N/A'}`}</Text>
                    <Text style={styles.dropdownText}>{`• Size: ${parseSizesToText(order?.appointment?.sizes) || 'N/A'}`}</Text>
                    <Text style={styles.dropdownText}>{`• Quantity: ${order?.appointment?.total_quantity ?? 'N/A'} pcs.`}</Text>
                    <Text style={styles.dropdownText}>{`• Due Date: ${
                      order?.appointment?.preferred_due_date
                        ? new Date(order.appointment.preferred_due_date).toLocaleDateString()
                        : 'N/A'
                    }`}</Text>
                    <Text style={styles.dropdownText}>{`• Notes: ${order?.appointment?.notes || 'N/A'}`}</Text>
                    <Text style={styles.dropdownText}>• Design Image:</Text>
                    {order?.appointment?.design_image ? (
                      <TouchableOpacity onPress={() => handleImagePress({ uri: order.appointment.design_image })}>
                        <Image source={{ uri: order.appointment.design_image }} style={styles.image} />
                      </TouchableOpacity>
                    ) : null}
                    <Text style={styles.dropdownText}>• Gcash Downpayment:</Text>
                    {order?.appointment?.gcash_proof ? (
                      <TouchableOpacity onPress={() => handleImagePress({ uri: order.appointment.gcash_proof })}>
                        <Image source={{ uri: order.appointment.gcash_proof }} style={styles.image} />
                      </TouchableOpacity>
                    ) : null}

                    {/* Feedback Section */}
                    <View style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E5E5E5' }}>
                      <Text style={styles.dropdownTitle}>Feedback:</Text>
                      {order.feedback ? (
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            {[1,2,3,4,5].map((v) => (
                              <MaterialIcons
                                key={v}
                                name={v <= (order.feedback.rating || 0) ? 'star' : 'star-border'}
                                size={18}
                                color={v <= (order.feedback.rating || 0) ? '#f5a623' : '#ccc'}
                                style={{ marginRight: 2 }}
                              />
                            ))}
                          </View>
                          {order.feedback.comment ? (
                            <Text style={styles.dropdownText}>{`Customer: ${order.feedback.comment}`}</Text>
                          ) : (
                            <Text style={styles.dropdownText}>Customer left no comment.</Text>
                          )}
                          <View style={{ marginTop: 6 }}>
                            {order.feedback.admin_response ? (
                              <Text style={[styles.dropdownText, { color: '#000' }]}>{`Admin: ${order.feedback.admin_response}`}</Text>
                            ) : order.feedback.admin_checked ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <MaterialIcons name="check-circle" size={18} color="#4caf50" />
                                <Text style={[styles.dropdownText, { marginLeft: 6 }]}>Admin checked your feedback.</Text>
                              </View>
                            ) : (
                              <Text style={[styles.dropdownText, { fontStyle: 'italic' }]}>No response yet.</Text>
                            )}
                          </View>
                        </View>
                      ) : (
                        <Text style={[styles.dropdownText, { fontStyle: 'italic' }]}>No feedback submitted.</Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.appointmentCard}>
            <View style={[styles.indicator, styles.indicatorCompleted]} />
            <View style={styles.cardContent}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>No finished orders yet</Text>
                <Text style={[styles.statusText, styles.statusCompleted]}></Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Image Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity style={styles.modalCloseButton} onPress={closeModal}>
            <MaterialIcons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image
              source={selectedImage}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  statusPending: {
    color: '#FFA500', // Orange for Pending
  },
  statusReadyToCheck: {
    color: '#e91e63', // Pink for Ready to Check
  },
  statusCompleted: {
    color: '#4caf50', // Green for Completed
  },
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
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
    alignSelf: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginTop: 20,
    marginBottom: 10,
  },
  reminderCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 10,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  indicator: {
    width: 4,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  indicatorGreen: {
    backgroundColor: '#16A34A',
  },
  indicatorOrange: {
    backgroundColor: '#FFA500',
  },
  indicatorBlue: {
    backgroundColor: '#4682B4',
  },
  icon: {
    marginHorizontal: 15,
  },
  cardContent: {
    flex: 1,
    padding: 15,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'nowrap',
    width: '100%',
  },
  orderInfo: {
    flex: 1,
    marginRight: 10,
    minWidth: 0, // Allows flex to work properly
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    maxWidth: '45%',
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500',
  },
  cardDate: {
    fontSize: 14,
    color: '#000',
    minWidth: 0,
    flexShrink: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 5,
    flexShrink: 1,
    minWidth: 0,
  },
  statusOngoing: {
    color: '#FFA500',
  },
  statusCompleted: {
    color: '#16A34A',
  },
  dropdownContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  dropdownTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 5,
  },
  dropdownText: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 3,
  },
  image: {
    width: 100,
    height: 100,
    resizeMode: 'contain',
    marginBottom: 10,
  },


  // Modal Styles
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '90%',
    height: '70%',
    borderRadius: 10,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
  },
});
