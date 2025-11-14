import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BookAppointment from '../../components/BookAppointment';
import { useAppointmentModal } from '../../contexts/AppointmentModalContext';

const CustomTabBarButton = (props) => {
  const { children, accessibilityState, style, ...restProps } = props;
  const focused = accessibilityState?.selected;
  
  // Get the route name from the accessibility label or testID
  const routeName = restProps.accessibilityLabel || restProps.testID || '';
  const isAppointments = routeName === 'Appointments';
  const isOrders = routeName === 'Orders';
  
  return (
    <TouchableOpacity
      {...restProps}
      style={[
        styles.tabButton,
        focused ? styles.tabButtonActive : styles.tabButtonInactive,
        isAppointments && styles.tabButtonAppointments,
        isOrders && styles.tabButtonOrders,
        style,
      ]}
      activeOpacity={0.7}
    >
      {children}
    </TouchableOpacity>
  );
};

const TabIcon = ({ focused, iconName, label }) => {
  // Map MaterialIcons names to MaterialCommunityIcons equivalents
  const iconMap = {
    'home': focused ? 'home' : 'home-outline',
    'event': focused ? 'calendar-check' : 'calendar-check-outline',
    'calendar-today': focused ? 'calendar' : 'calendar-outline',
    'person': focused ? 'account' : 'account-outline',
  };
  
  const iconToUse = iconMap[iconName] || (focused ? iconName : `${iconName}-outline`);
  
  return (
    <View style={styles.tabContent}>
      <MaterialCommunityIcons 
        name={iconToUse} 
        size={28} 
        color={focused ? '#1E88E5' : '#5C7A9A'} 
      />
      <View style={styles.labelContainer}>
        <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {label}
        </Text>
        {focused && <View style={styles.underline} />}
      </View>
    </View>
  );
};

export default function TabsLayout() {
  const { isOpen: modalVisible, openModal, closeModal } = useAppointmentModal();

  return (
    <View style={{ flex: 1 }}>
      <BookAppointment visible={modalVisible} onClose={closeModal} />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#1E88E5',
          tabBarInactiveTintColor: '#5C7A9A',
          tabBarStyle: {
            height: 100,
            paddingBottom: 3,
            paddingTop: 6,
            paddingHorizontal: 2,
            backgroundColor: '#E6F2F8',
            borderTopWidth: 0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: {
              width: 0,
              height: -2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            position: 'relative',
          },
          tabBarShowLabel: false,
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName="home" label="Home" />
          ),
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appooint.',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName="event" label="Appoint." />
          ),
          tabBarButton: (props) => <CustomTabBarButton {...props} accessibilityLabel="Appointments" />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName="calendar-today" label="Orders" />
          ),
          tabBarButton: (props) => <CustomTabBarButton {...props} accessibilityLabel="Orders" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName="person" label="Profile" />
          ),
          tabBarButton: (props) => <CustomTabBarButton {...props} />,
        }}
      />
      </Tabs>
      {/* Centered Plus Button with Dent Effect */}
      <View style={styles.centeredButtonContainer}>
        <TouchableOpacity 
          style={styles.centeredButton}
          onPress={openModal}
          activeOpacity={0.8}
        >
          <MaterialIcons name="add" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    flex: 1,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 1,
    paddingVertical: 1,
    paddingHorizontal: 1,
  },
  tabButtonInactive: {
    paddingHorizontal: 1,
  },
  tabButtonAppointments: {
    marginRight: 42, //5 Add spacing on the right side (towards the centered button)
  },
  tabButtonOrders: {
    marginLeft: 42, // Add spacing on the left side (towards the centered button)
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },
  labelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  label: {
    fontSize: 10,
    color: '#5C7A9A',
    fontWeight: '400',
  },
  labelActive: {
    color: '#1E88E5',
    fontWeight: '600',
  },
  underline: {
    width: 20,
    height: 2,
    backgroundColor: '#1E88E5',
    marginTop: 2,
    borderRadius: 1,
  },
  centeredButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
    pointerEvents: 'box-none', // Allow touches to pass through container to tabs below
  },
  centeredButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#4682B4',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -32, // Half height to create the dent effect
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 10,
    borderWidth: 4,
    borderColor: '#E6F2F8',
    zIndex: 11,
    pointerEvents: 'auto', // Button itself should receive touches
  },
});