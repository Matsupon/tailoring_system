import { FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from 'react-native';
import api from '../../utils/api';

export default function SignUp() {
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [address, setAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/register', {
        name: fullName,
        email,
        phone,
        password,
        address,
      });

      console.log('Registration successful:', response.data);

      const token = response.data?.access_token;
      if (token) {
        await AsyncStorage.setItem('authToken', token);
        router.replace('/(tabs)');
        return;
      }

      const loginRes = await api.post('/login', { email, password });
      const loginToken = loginRes.data?.access_token;
      if (loginToken) {
        await AsyncStorage.setItem('authToken', loginToken);
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/login');
      }
    } catch (error) {
      console.error('Registration failed:', error.response?.data || error.message);
      
      // Handle specific error cases
      if (error.response?.status === 422) {
        // Check if it's a duplicate email error
        const errorMessage = error.response?.data?.message || '';
        const errors = error.response?.data?.errors || {};
        
        if (errorMessage.toLowerCase().includes('email') || errors.email) {
          alert('This email is already registered. Please use a different email or login instead.');
        } else {
          alert(errorMessage || 'Registration failed. Please check your inputs and try again.');
        }
      } else if (error.response?.status === 401) {
        alert('Invalid credentials. Please check your information and try again.');
      } else if (error.response?.data?.message) {
        alert(error.response.data.message);
      } else if (error.message === 'Network Error' || error.code === 'ECONNABORTED') {
        alert('Network error. Please check your internet connection and try again.');
      } else {
        alert('Could not register. Please check your inputs and try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#e0f4ff', '#b3e5fc']}
      style={styles.gradientContainer}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
            />
            <Text style={styles.title}>Jun Tailoring{'\n'}Appointment System</Text>

            <Text style={styles.subtitle}>Create an Account!</Text>
            <Text style={styles.description}>
              Create account by filling the form below.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <FontAwesome5 name="user" size={20} color="#687076" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter full name"
                  placeholderTextColor="#687076"
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputContainer}>
                <MaterialIcons name="email" size={20} color="#687076" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter email"
                  placeholderTextColor="#687076"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputContainer}>
                <FontAwesome5 name="phone" size={20} color="#687076" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter phone number"
                  placeholderTextColor="#687076"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
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
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={20}
                    color="#687076"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.inputContainer}>
                <FontAwesome5 name="home" size={20} color="#687076" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Address"
                  placeholderTextColor="#687076"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <TouchableOpacity 
                style={[styles.signupButton, isLoading && styles.signupButtonDisabled]} 
                onPress={handleSignUp}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 10 }} />
                    <Text style={styles.signupButtonText}>SIGNING UP...</Text>
                  </View>
                ) : (
                  <Text style={styles.signupButtonText}>SIGN UP</Text>
                )}
              </TouchableOpacity>

              <View style={styles.loginContainer}>
                <Text style={styles.loginText}>Already have an account? </Text>
                <Link href="/auth/login" style={styles.loginLink}>
                  LOGIN
                </Link>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 5,
    paddingBottom: 80,
  },
  container: {
    alignItems: 'center',
    width: '100%',
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 20,
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
  signupButton: {
    backgroundColor: '#4682B4',
    borderRadius: 10,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  signupButtonDisabled: {
    backgroundColor: '#a0a0a0',
  },
  signupButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 40,
  },
  loginText: {
    color: '#687076',
  },
  loginLink: {
    color: '#4682B4',
    fontWeight: 'bold',
  },
});
