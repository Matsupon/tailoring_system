import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AppState, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import api from '../utils/api';

export default function Header({ userName = 'User', onNotificationsViewed, onRef }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const appState = useRef(AppState.currentState);
  const segments = useSegments(); // Track route changes for Expo Router
  const prevSegmentRef = useRef(null); // Initialize to null to detect first route

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications');
      if (res.data?.success) {
        const list = (res.data.data || []);
        list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setNotifications(list);
      }
    } catch (e) {
      // 401 errors are handled by the API interceptor
      // Network errors are expected if server is not running - handle gracefully
      if (e?.response?.status === 401) {
        // Unauthorized - user not logged in, this is handled by API interceptor
        return;
      }
      
      // Network errors - server might not be running or not accessible
      if (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error') {
        // Silently fail - server is not accessible
        // This is expected if backend is not running
        console.log('⚠️ Notifications: Server not accessible. Backend may not be running.');
        return;
      }
      
      // Other errors
      console.log('Failed to load notifications', e?.message || e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to refresh lastSeenAt from AsyncStorage
  const refreshLastSeenAt = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem('notifications_last_seen_at');
      if (saved) {
        setLastSeenAt(saved);
      }
    } catch (error) {
      console.log('Error refreshing lastSeenAt:', error);
    }
  }, []);

  const markAllAsSeen = async () => {
    try {
      const now = new Date().toISOString();
      await AsyncStorage.setItem('notifications_last_seen_at', now);
      setLastSeenAt(now);
      // Trigger a refresh on other pages by updating AsyncStorage
      // Other Header instances will pick this up through their polling
    } catch (_) {}
    if (typeof onNotificationsViewed === 'function') {
      onNotificationsViewed();
    }
  };

  const unreadCount = notifications.filter(n => !lastSeenAt || new Date(n.created_at).getTime() > new Date(lastSeenAt).getTime()).length;

  // Expose refresh method to parent components via callback ref
  useEffect(() => {
    if (onRef && typeof onRef === 'function') {
      onRef({
        refreshNotifications: () => {
          loadNotifications();
          refreshLastSeenAt();
        },
      });
    }
  }, [onRef, loadNotifications, refreshLastSeenAt]);

  // Initial load
  useEffect(() => {
    loadNotifications();
    refreshLastSeenAt();
  }, [loadNotifications, refreshLastSeenAt]);

  // Refresh when route changes (page navigation) - Expo Router
  // This ensures notifications sync when navigating between pages
  useEffect(() => {
    // Skip first render (prevSegmentRef is null)
    if (prevSegmentRef.current === null) {
      prevSegmentRef.current = segments;
      return;
    }
    
    // Check if route changed
    const routeChanged = JSON.stringify(segments) !== JSON.stringify(prevSegmentRef.current);
    if (routeChanged) {
      // Route changed, refresh notifications to sync badge count
      loadNotifications();
      refreshLastSeenAt();
      prevSegmentRef.current = segments;
    }
  }, [segments, loadNotifications, refreshLastSeenAt]);

  // Listen to AppState changes to refresh when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground, refresh notifications
        loadNotifications();
        refreshLastSeenAt();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription?.remove();
    };
  }, [loadNotifications, refreshLastSeenAt]);

  // More frequent check for AsyncStorage changes to sync across pages
  // This checks every 2 seconds for lastSeenAt changes (lightweight operation)
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      try {
        const saved = await AsyncStorage.getItem('notifications_last_seen_at');
        if (saved !== lastSeenAt) {
          // lastSeenAt changed, update state to sync badge count
          setLastSeenAt(saved);
          // Also refresh notifications to ensure we have latest data
          await loadNotifications();
        }
      } catch (error) {
        // Silently fail - AsyncStorage errors are rare
      }
    }, 2000); // Check every 2 seconds for sync

    return () => clearInterval(syncInterval);
  }, [lastSeenAt, loadNotifications]);

  // Less frequent full refresh of notifications from server (every 30 seconds)
  // This is separate from the sync check above
  useEffect(() => {
    const refreshInterval = setInterval(async () => {
      try {
        await loadNotifications();
        await refreshLastSeenAt();
      } catch (error) {
        // Errors are already handled in loadNotifications, just log here if needed
        if (error?.code !== 'ERR_NETWORK' && error?.message !== 'Network Error') {
          console.log('Notification refresh error:', error?.message);
        }
      }
    }, 30000); // 30 seconds - full refresh from server

    return () => clearInterval(refreshInterval);
  }, [loadNotifications, refreshLastSeenAt]);

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

  const getNotificationTitle = (notification) => {
    if (notification.type === 'appointment_booked') {
      return 'You have successfully booked an appointment!';
    } else if (notification.type === 'ready_to_check') {
      return 'Your order is now ready to check';
    } else if (notification.type === 'order_completed') {
      return 'Your order is now completed';
    } else if (notification.type === 'appointment_rejected') {
      return "We're sorry, unfortunately your appointment has been rejected by the admin.";
    } else if (notification.type === 'feedback_responded') {
      return notification.title || 'Admin responded to your feedback';
    } else if (notification.type === 'order_finished') {
      return 'Congratulations! Your order is now finished!';
    } else if (notification.type === 'order_details_updated') {
      return 'You have successfully updated your Order Details!';
    } else if (notification.type === 'order_cancelled') {
      return 'You have successfully cancelled an order!';
    } else if (notification.type === 'refund_processed') {
      return 'Your down payment for the cancelled appointment/order has been successfully refunded by the admin.';
    }
    return notification.title || 'Notification';
  };

  const getNotificationBody = (notification) => {
    if (notification.type === 'appointment_booked') {
      return notification.body || 'Please wait while the admin reviews your appointment request. Your order will be processed once it has been approved. In the meantime, you can check your submitted appointment at the "My Profile" page under the "My Appointments" section.';
    } else if (notification.type === 'ready_to_check') {
      return 'Your order is now ready to check. Please visit us to review your order.';
    } else if (notification.type === 'order_completed') {
      const amount = notification.data?.total_amount 
        ? `Please prepare ₱${Number(notification.data.total_amount).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} to get your order.`
        : '';
      return `Your order is now completed. ${amount}`.trim();
    } else if (notification.type === 'appointment_rejected') {
      return 'Please check the "My Appointments" page to view your refunded down payment.';
    } else if (notification.type === 'feedback_responded') {
      const checked = notification.data?.admin_checked;
      const resp = notification.data?.admin_response;
      if (resp) return resp;
      if (checked) return 'The admin has reviewed your feedback.';
      return notification.body || '';
    } else if (notification.type === 'order_finished') {
      return 'Please go to the \'My Orders\' page and under the \'Order History\' section to check your finished order!';
    } else if (notification.type === 'order_details_updated') {
      return 'Your order details have been successfully updated.';
    } else if (notification.type === 'order_cancelled') {
      return notification.body || '';
    } else if (notification.type === 'refund_processed') {
      return 'Your down payment for the cancelled appointment/order has been successfully refunded by the admin. Please go to the "Appointments" page to check your refund status.';
    }
    return notification.body || '';
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.leftSection}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
          />
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Jun Tailoring</Text>
            <Text style={styles.subtitle}>Appointment System</Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.profileContainer}
          onPress={() => {
            const next = !showNotifications;
            setShowNotifications(next);
            if (next) {
              // Ensure we have the latest notifications before marking as seen
              Promise.resolve(loadNotifications()).finally(() => {
                // Mark as seen when opening the dropdown
                markAllAsSeen();
              });
            }
          }}
        >
          <MaterialIcons name="notifications" size={40} color="#4682B4" />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Notification Dropdown */}
      {showNotifications && (
        <View style={styles.notificationDropdown}>
          
          <ScrollView style={styles.notificationList} showsVerticalScrollIndicator={true}>
            {loading ? (
              <Text style={styles.noNotificationsText}>Loading notifications...</Text>
            ) : notifications.length === 0 ? (
              <Text style={styles.noNotificationsText}>No notifications yet</Text>
            ) : (
              notifications.map((notification) => (
                <View key={notification.id} style={styles.notificationItem}>
                  <Text style={styles.notificationDate}>{formatMonthDay(notification.created_at)}</Text>
                  <View style={styles.notificationContent}>
                    <Text style={styles.notificationTitle}>{getNotificationTitle(notification)}</Text>
                    {notification.type === 'appointment_booked' || notification.type === 'refund_processed' ? (
                      <View>
                        <Text style={styles.notificationBody}>{getNotificationBody(notification)}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                          <Text style={styles.notificationTime}>{formatTime12(notification.created_at)}</Text>
                          <TouchableOpacity 
                            onPress={() => {
                              setSelectedNotification(notification);
                              setDetailsModalVisible(true);
                            }} 
                            style={{ marginLeft: 12 }}
                          >
                            <Text style={styles.viewMoreLink}>View More</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View>
                        <Text style={styles.notificationBody}>{getNotificationBody(notification)}</Text>
                        <Text style={styles.notificationTime}>{formatTime12(notification.created_at)}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Details Modal */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedNotification?.type === 'refund_processed' ? 'Refund Details' : 'Appointment Details'}
              </Text>
              <TouchableOpacity onPress={() => setDetailsModalVisible(false)}>
                <MaterialIcons name="close" size={22} color="#000" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={true}>
              {selectedNotification && selectedNotification.type === 'appointment_booked' && (
                <View>
                  <Text style={[styles.modalBody, { lineHeight: 22 }]}>
                    {selectedNotification.body || 'Please wait while the admin reviews your appointment request. Your order will be processed once it has been approved. In the meantime, you can check your submitted appointment at the "My Profile" page under the "My Appointments" section.'}
                  </Text>
                </View>
              )}
              {selectedNotification && selectedNotification.type === 'refund_processed' && (
                <View>
                  <Text style={[styles.modalBody, { fontSize: 15, color: '#16A34A', fontWeight: '600', marginBottom: 12, lineHeight: 22 }]}>
                    {selectedNotification.title || 'Your down payment for the cancelled appointment/order has been successfully refunded by the admin. Please go to the "Appointments" page to check your refund status.'}
                  </Text>
                  {selectedNotification.data?.refund_image && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={[styles.modalBody, { fontSize: 14, color: '#666', marginBottom: 8 }]}>
                        GCash Refund Proof:
                      </Text>
                      <Image
                        source={{ uri: selectedNotification.data.refund_image }}
                        style={{ width: '100%', height: 200, borderRadius: 8, resizeMode: 'contain' }}
                      />
                    </View>
                  )}
                </View>
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
    width: '100%',
    height: 110,
    position: 'relative',
    backgroundColor: '#e0f4ff',
    paddingTop: 40,
  },
  content: {
    height: 70,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#e0f4ff', 
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 70,
    height: 70,
    resizeMode: 'contain',
  },
  titleContainer: {
    marginLeft: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  profileContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#e91e63',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  notificationDropdown: {
    position: 'absolute',
    top: 110,
    right: 20,
    width: 300,
    maxHeight: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    zIndex: 1000,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  notificationList: {
    maxHeight: 350,
    paddingTop: 10,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  notificationDate: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginRight: 15,
    width: 45,
  },
  notificationContent: {
    flex: 1,
  },
  notificationBody: {
    fontSize: 14,
    color: '#687076',
    marginTop: 2,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
    color: '#687076',
    marginTop: 5,
  },
  noNotificationsText: {
    padding: 20,
    textAlign: 'center',
    color: '#687076',
    fontSize: 14,
  },
  viewMoreLink: {
    color: '#4682B4',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  modalBody: {
    fontSize: 16,
    color: '#16A34A',
    fontWeight: '600',
    lineHeight: 22,
  },
}); 