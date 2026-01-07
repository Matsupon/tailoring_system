import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import api from '../../utils/api';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert('Please enter a valid email address');
      return;
    }

    // Log the server URL being used for debugging
    const serverURL = api.defaults.baseURL;
    const serverHost = serverURL ? serverURL.replace('/api', '').replace(/\/$/, '') : 'Unknown';
    console.log('Attempting login to:', serverHost);
    console.log('Full API URL:', serverURL);

    setLoading(true); 
    try {
      const response = await api.post('/login', {
        email,
        password,
      });
  
      const token = response.data.access_token;
  
      if (token) {
        await AsyncStorage.setItem('authToken', token);
        console.log('Login successful, token saved:', token);
  
        router.replace('/(tabs)'); 
      } else {
        console.error('Token not received from backend:', response.data);
        alert('Login failed. No token received from server.');
      }
  
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        baseURL: error.config?.baseURL || api.defaults.baseURL,
        url: error.config?.url,
        fullUrl: error.config ? `${error.config.baseURL || ''}${error.config.url || ''}` : 'Unknown',
      });
      
      // Handle specific error cases
      if (error.response?.status === 401) {
        alert('Invalid email or password. Please check your credentials and try again.');
      } else if (error.response?.status === 404) {
        alert('Account not found. Please check your email address.');
      } else if (error.response?.status === 422) {
        alert(error.response?.data?.message || 'Invalid email or password. Please try again.');
      } else if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else if (error.code === 'ERR_NETWORK' || error.message === 'Network Error' || error.code === 'ECONNABORTED') {
        // Get the server URL from the error config or API defaults
        const serverURL = error.config?.baseURL || api.defaults.baseURL;
        const serverHost = serverURL ? serverURL.replace('/api', '').replace(/\/$/, '') : 'the server';
        const fullUrl = error.config ? `${error.config.baseURL || ''}${error.config.url || ''}` : 'Unknown';
        
        alert(`Cannot connect to the server!\n\nServer: ${serverHost}\nEndpoint: ${fullUrl}\n\nPlease check:\n1. Backend server is running\n2. Server is listening on 0.0.0.0 (not just localhost)\n3. Both devices are on the same network\n4. Firewall is not blocking port 8000\n5. IP address is correct: ${serverHost}\n\nTo fix:\n- Run: php artisan serve --host=0.0.0.0 --port=8000`);
      } else {
        alert(`Login failed: ${error.message || 'Unknown error'}\n\nPlease try again.`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#e0f4ff', '#b3e5fc']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Image 
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
          />
          
          <Text style={styles.title}>Jun Tailoring{'\n'}Appointment System</Text>
          
          <Text style={styles.subtitle}>Welcome Back!</Text>
          <Text style={styles.description}>Login into your account below.</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={20} color="#687076" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#687076"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#687076" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#687076"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                returnKeyType="done"
              />
              <TouchableOpacity 
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons 
                  name={showPassword ? "eye-off" : "eye"} 
                  size={20} 
                  color="#687076" 
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.loginButton} 
              onPress={handleLogin}
              disabled={loading} 
            >
              {loading ? (
                <ActivityIndicator color="#fff" /> 
              ) : (
                <Text style={styles.loginButtonText}>LOGIN</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>Don't have an account yet? </Text>
              <Link href="/auth/signup" style={styles.signupLink}>SIGNUP</Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoiding: {
    flex: 1,
    width: '100%',
  },
  scrollContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 30,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 5,
  },
  description: {
    fontSize: 14,
    color: '#687076',
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 50,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: '100%',
    color: '#000',
  },
  eyeIcon: {
    padding: 5,
  },
  loginButton: {
    backgroundColor: '#4682B4',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: '#687076',
  },
  signupLink: {
    color: '#4682B4',
    fontWeight: 'bold',
  },
});