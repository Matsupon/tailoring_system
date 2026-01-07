import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Dimensions, Easing, Image, Modal, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Header from '../../components/Header';
import api from '../../utils/api';

export default function ProfilePage() {
  const headerRefreshFn = useRef(null);
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [tempImage, setTempImage] = useState(null);
  const [profileImageUrl, setProfileImageUrl] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '' });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [refreshing, setRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const showSuccessMessage = () => {
    setShowSuccessModal(true);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      hideSuccessMessage();
    }, 2000);
  };

  const hideSuccessMessage = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start(() => {
      setShowSuccessModal(false);
    });
  };

  const fetchUserData = async () => {
    try {
      const response = await api.get('/user');
      
      setUser(response.data.user);
      setProfileImageUrl(response.data.user?.image_url); 

      if (response.data.image_url) {
        setProfileImageUrl(response.data.image_url);
      }

      // initialize form fields
      const u = response.data.user || {};
      setForm({
        name: u.name || '',
        email: u.email || '',
        phone: u.phone || '',
        address: u.address || '',
        password: '',
      });
    } catch (error) {
      console.error('Failed to fetch user:', error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      const formData = new FormData();
      let hasChanges = false;
      
      // Add text fields (only if they differ from current user data)
      if (form.name && form.name !== user?.name) {
        formData.append('name', form.name);
        hasChanges = true;
      }
      if (form.email && form.email !== user?.email) {
        formData.append('email', form.email);
        hasChanges = true;
      }
      if (form.phone && form.phone !== user?.phone) {
        formData.append('phone', form.phone);
        hasChanges = true;
      }
      if (form.address && form.address !== user?.address) {
        formData.append('address', form.address);
        hasChanges = true;
      }
      if (form.password && form.password.trim() !== '') {
        formData.append('password', form.password);
        hasChanges = true;
      }

      // Add profile image if tempImage exists (user selected a new image)
      if (tempImage) {
        // Compress image before including in FormData
        let finalImageUri = tempImage;
        try {
          console.log('📦 Compressing profile image for save...');
          const compressed = await ImageManipulator.manipulateAsync(
            tempImage,
            [{ resize: { width: 512 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          finalImageUri = compressed.uri;
          console.log('✅ Profile image compressed for save');
        } catch (compressError) {
          console.warn('⚠️ Failed to compress profile image, using original:', compressError);
          finalImageUri = tempImage;
        }

        const fileType = 'image/jpeg'; // Always JPEG after compression
        const fileName = `profile_${user.id}_${Date.now()}.jpg`;
        formData.append('profile_image', {
          uri: finalImageUri,
          name: fileName,
          type: fileType,
        });
        hasChanges = true;
        console.log('📦 Including profile image in FormData:', { uri: finalImageUri, name: fileName, type: fileType });
      }

      // Check if there are any changes to save
      if (!hasChanges) {
        Alert.alert('No Changes', 'No changes detected. Please modify at least one field before saving.');
        return;
      }

      console.log('📤 Sending profile update request...', {
        hasImage: !!tempImage,
        fields: {
          name: form.name !== user?.name,
          email: form.email !== user?.email,
          phone: form.phone !== user?.phone,
          address: form.address !== user?.address,
          password: form.password && form.password.trim() !== '',
        },
        serverURL: api.defaults.baseURL,
        formDataKeys: tempImage ? 'Has FormData with image' : 'FormData without image',
      });
      
      // If no image, try sending as JSON first (more reliable on weak networks)
      // If image exists, must use FormData
      let response;
      if (!tempImage) {
        // Convert FormData to JSON object for text-only updates
        const jsonData = {};
        if (form.name && form.name !== user?.name) jsonData.name = form.name;
        if (form.email && form.email !== user?.email) jsonData.email = form.email;
        if (form.phone && form.phone !== user?.phone) jsonData.phone = form.phone;
        if (form.address && form.address !== user?.address) jsonData.address = form.address;
        if (form.password && form.password.trim() !== '') jsonData.password = form.password;
        
        console.log('📤 Sending as JSON (no image):', jsonData);
        response = await api.post('/profile', jsonData, {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });
      } else {
        // Use FormData when image is included
        console.log('📤 Sending as FormData (with image)');
        // Don't set Content-Type header - let axios automatically set it with boundary for FormData
        // Increase timeout for profile updates with images and disable retries for FormData
        response = await api.post('/profile', formData, {
          timeout: 120000, // 120 seconds for file uploads (increased)
          headers: {
            'Accept': 'application/json',
          },
          // Disable retries for FormData uploads to avoid issues with FormData preservation
          __disableRetry: true,
        });
      }

      console.log('✅ Profile update successful:', response.data);
      
      setUser(response.data.user);
      setProfileImageUrl(response.data.image_url);
      setTempImage(null); // Clear temp image after successful upload
      setIsEditing(false);
      showSuccessMessage();
      // Refresh notifications in header (in case profile update triggers a notification)
      if (headerRefreshFn.current) {
        setTimeout(() => {
          headerRefreshFn.current?.refreshNotifications();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Profile save failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Reset temp image on error so user can try again
      if (tempImage) {
        setTempImage(null);
      }
      
      let errorMessage = 'Could not update profile.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        errorMessage = Object.values(errors).flat().join('\n');
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const serverURL = api.defaults.baseURL?.replace('/api', '') || 'the server';
        errorMessage = `Network error. Please check:\n\n1. Your internet connection\n2. Server is running at ${serverURL}\n3. Try again in a moment`;
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Request timed out. Please check your connection and try again.';
      }
      
      Alert.alert('Update Failed', errorMessage);
    }
  };

  const handleLogout = async () => {
    // Prevent multiple simultaneous logout requests
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    try {
      // Try to logout on server, but always clear local token and redirect
      try {
        await api.post('/logout', {}, {
          // Mark this request so the interceptor knows to suppress 401 errors
          __isLogoutRequest: true,
        });
      } catch (logoutError) {
        // 401 errors are expected if token was already invalidated or user already logged out
        // Don't log these as errors - they're normal during logout
        if (logoutError?.response?.status !== 401) {
          console.log('Server logout failed:', logoutError?.response?.status);
        }
      }
      await AsyncStorage.removeItem('authToken');
      router.replace('/auth/login');
    } catch (error) {
      // Always clear token and redirect even if there's an error
      try {
        await AsyncStorage.removeItem('authToken');
      } catch (storageError) {
        console.log('Error removing token:', storageError);
      }
      router.replace('/auth/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const pickImage = async () => {
    console.log('Edit icon pressed');
    if (uploading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Allow access to gallery to choose a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      setTempImage(uri);
      await uploadProfileImage(uri);
    }
  };

  const uploadProfileImage = async (uri) => {
    setUploading(true);
    try {
      // Compress and optimize image before upload to reduce payload size and improve reliability
      let finalImageUri = uri;
      try {
        console.log('📦 Compressing profile image...');
        const compressed = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 512 } }], // Resize to max 512px width for profile images (smaller than design images)
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // Good compression while maintaining quality
        );
        finalImageUri = compressed.uri;
        console.log('✅ Profile image compressed');
      } catch (compressError) {
        console.warn('⚠️ Failed to compress profile image, using original:', compressError);
        finalImageUri = uri;
      }

      // Quick connectivity check before attempting upload
      try {
        await api.get('/user', { timeout: 5000 });
        console.log('✅ Connectivity check passed');
      } catch (connectError) {
        console.warn('⚠️ Connectivity check failed:', connectError.message);
        // Continue anyway, but user will see error if server is truly unreachable
      }

      const formData = new FormData();
      const fileType = 'image/jpeg'; // Always JPEG after compression
      const fileName = `profile_${user?.id || 'user'}_${Date.now()}.jpg`;
  
      formData.append('profile_image', {
        uri: finalImageUri,
        name: fileName,
        type: fileType,
      });
  
      console.log('📦 Uploading profile image:', { 
        uri: finalImageUri, 
        name: fileName, 
        type: fileType, 
        serverURL: api.defaults.baseURL 
      });
  
      // Don't set Content-Type header - let axios automatically set it with boundary for FormData
      // Increase timeout for file uploads and disable retries for FormData (handled in api.js)
      const response = await api.post('/profile', formData, {
        timeout: 120000, // 120 seconds for file uploads (increased)
        headers: {
          'Accept': 'application/json',
        },
        // Disable retries for FormData uploads to avoid issues with FormData preservation
        __disableRetry: true,
      });
  
      console.log('✅ Profile image upload successful:', response.data);
  
      setUser(response.data.user);
      setProfileImageUrl(response.data.image_url); 
      setTempImage(null);
      showSuccessMessage();
      // Refresh notifications in header (in case profile image update triggers a notification)
      if (headerRefreshFn.current) {
        setTimeout(() => {
          headerRefreshFn.current?.refreshNotifications();
        }, 500);
      }
    } catch (error) {
      console.error('❌ Profile image upload failed:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
      });
      
      // Reset temp image on error so user can try again
      setTempImage(null);
      
      let errorMessage = 'Could not update profile picture.';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        errorMessage = Object.values(errors).flat().join('\n');
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const serverURL = api.defaults.baseURL?.replace('/api', '') || 'the server';
        errorMessage = `Network error. Please check:\n\n1. Your internet connection\n2. Server is running at ${serverURL}\n3. Try again in a moment`;
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = 'Upload timed out. Please check your connection and try again.';
      }
      
      Alert.alert('Upload Failed', errorMessage);
    } finally {
      setUploading(false);
    }
  };
  

  const getProfileImageUrl = () => {
    if (tempImage) return tempImage;
    if (profileImageUrl) return profileImageUrl;
    if (user?.profile_image) {
      // Use the base URL from the api utility
      const baseURL = api.defaults.baseURL;
      if (baseURL) {
        return `${baseURL.replace('/api', '')}/storage/${user.profile_image}`;
      }
    }
    return null;
  };


  // Pull to refresh function
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchUserData();
      // Refresh notifications in header if available
      if (headerRefreshFn.current) {
        headerRefreshFn.current?.refreshNotifications();
      }
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4682B4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.background} />
      <Header onRef={(fn) => { headerRefreshFn.current = fn; }} userName={user?.name || "User"} />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.pageTitle}>My Profile</Text>

        <View style={styles.avatarContainer}>
          <TouchableOpacity onPress={pickImage} disabled={uploading}>
            {uploading ? (
              <View style={styles.profileImagePlaceholder}>
                <ActivityIndicator size="large" color="#4682B4" />
              </View>
            ) : tempImage ? (
              <Image source={{ uri: tempImage }} style={styles.profileImage} />
            ) : getProfileImageUrl() ? (
              <Image 
              source={{ uri: getProfileImageUrl() }} 
              style={styles.profileImage}
              onError={(error) => console.log('Image loading error:', error)}
            />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <MaterialIcons name="account-circle" size={80} color="#4682B4" />
              </View>
            )}
            <View style={styles.editIcon}>
              <MaterialIcons name="edit" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={[styles.input, isEditing && styles.inputEditing]}
            value={isEditing ? form.name : user?.name}
            editable={isEditing}
            onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, isEditing && styles.inputEditing]}
            value={isEditing ? form.email : user?.email}
            editable={isEditing}
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={(t) => setForm((p) => ({ ...p, email: t }))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={[styles.input, isEditing && styles.inputEditing]}
            value={isEditing ? form.phone : user?.phone}
            editable={isEditing}
            keyboardType="phone-pad"
            onChangeText={(t) => setForm((p) => ({ ...p, phone: t }))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Address</Text>
          <TextInput
            style={[styles.input, isEditing && styles.inputEditing]}
            value={isEditing ? form.address : user?.address}
            editable={isEditing}
            onChangeText={(t) => setForm((p) => ({ ...p, address: t }))}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={[styles.input, isEditing && styles.inputEditing]}
            value={isEditing ? form.password : '********'}
            secureTextEntry
            editable={isEditing}
            onChangeText={(t) => setForm((p) => ({ ...p, password: t }))}
            placeholder={isEditing ? 'Leave blank to keep current password' : undefined}
          />
        </View>

        <View style={styles.buttonContainer}>
          {isEditing ? (
            <>
              <TouchableOpacity style={styles.editButton} onPress={saveProfile}>
                <Text style={styles.buttonText}>SAVE CHANGES</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelButton} onPress={() => { setIsEditing(false); setForm((p) => ({...p, password: ''})); }}>
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Text style={styles.buttonText}>EDIT PROFILE</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={[styles.logoutButton, isLoggingOut && styles.logoutButtonDisabled]} 
            onPress={handleLogout}
            disabled={isLoggingOut}
          >
            <Text style={styles.buttonText}>{isLoggingOut ? 'LOGGING OUT...' : 'LOGOUT'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        transparent={true}
        visible={showSuccessModal}
        animationType="none"
        onRequestClose={hideSuccessMessage}
      >
        <View style={styles.modalContainer}>
          <Animated.View style={[styles.successModal, { opacity: fadeAnim }]}>
            <MaterialIcons name="check-circle" size={50} color="#4CAF50" />
            <Text style={styles.successText}>Profile Updated Successfully!</Text>
          </Animated.View>
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
  scrollContent: {
    paddingTop: 10,
    padding: 15,
    paddingBottom: 30,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
    alignSelf: 'center',
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4682B4',
    borderRadius: 16,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
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
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
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
  },
  inputGroup: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  inputEditing: {
    borderColor: '#4682B4',
    backgroundColor: '#fff',
    shadowColor: '#4682B4',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonContainer: {
    marginTop: 20,
    gap: 8,
  },
  editButton: {
    backgroundColor: '#4682B4',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButton: {
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4682B4',
  },
  cancelButtonText: {
    color: '#4682B4',
    fontSize: 14,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 40,
  },
  logoutButtonDisabled: {
    backgroundColor: '#CCCCCC',
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#4682B4',
  },
  profileImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderWidth: 2,
    borderColor: '#4682B4',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  successModal: {
    backgroundColor: 'white',
    padding: 25,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  successText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  // My Appointments Modal Styles
  appointmentsModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  appointmentsModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '85%',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'column',
  },
  appointmentsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  appointmentsModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  searchFilterContainer: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 10,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBar: {
    flex: 1,
    fontSize: 14,
    color: '#000',
  },
  filterContainer: {
    position: 'relative',
    zIndex: 100,
  },
  filterButton: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterDropdownOverlay: {
    position: 'absolute',
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -1000,
    zIndex: 999,
  },
  filterDropdown: {
    position: 'absolute',
    top: 45,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
    minWidth: 120,
  },
  filterItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterItemActive: {
    backgroundColor: '#e3f2fd',
  },
  filterItemText: {
    fontSize: 14,
    color: '#000',
  },
  filterItemTextActive: {
    color: '#4682B4',
    fontWeight: 'bold',
  },
  appointmentsList: {
    flex: 1,
    minHeight: 200,
  },
  appointmentsListContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  appointmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  appointmentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  appointmentCardHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  appointmentServiceType: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  queueNumberText: {
    fontSize: 12,
    color: '#4682B4',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  appointmentCardBody: {
    marginBottom: 10,
  },
  appointmentDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  appointmentDetailText: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  appointmentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#4682B4',
    fontWeight: '500',
  },
  // Order Details Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderDetailsModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '90%',
    maxHeight: '85%',
    padding: 20,
    overflow: 'hidden',
  },
  orderDetailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    flexShrink: 0,
  },
  orderDetailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  orderDetailsContent: {
    marginBottom: 15,
    maxHeight: Dimensions.get('window').height * 0.55,
  },
  orderDetailsContentContainer: {
    paddingBottom: 20,
  },
  detailSection: {
    marginBottom: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    color: '#000',
    flex: 1,
    textAlign: 'right',
  },
  detailNotesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  orderDetailsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
    flexShrink: 0,
  },
  editDetailsButton: {
    backgroundColor: '#4682B4',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  editDetailsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  cancelDetailsButton: {
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  cancelDetailsButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Edit Modal Styles
  editModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  editModalContent: {
    maxHeight: 400,
  },
  editInputGroup: {
    marginBottom: 15,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fff',
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
  },
  editDropdownItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  unavailableSlot: {
    backgroundColor: '#f8f8f8',
    opacity: 0.7,
  },
  editHelperText: {
    fontSize: 15,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  editModalFooter: {
    marginTop: 15,
  },
  editSubmitButton: {
    backgroundColor: '#4682B4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  editSubmitButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Confirmation Modal Styles
  confirmationModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '85%',
    padding: 20,
    alignItems: 'center',
  },
  confirmationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmationMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmationNoButton: {
    flex: 1,
    backgroundColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmationNoButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmationYesButton: {
    flex: 1,
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmationYesButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Cancel Success Modal
  cancelSuccessModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '85%',
    padding: 20,
  },
  // Image Display Styles
  imageContainer: {
    marginBottom: 20,
  },
  imageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  imageWrapper: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  thumbnailImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f5f5f5',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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