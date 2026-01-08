import axios from "axios";

// By using just "/api", the browser automatically uses your current domain.
const baseURL = "/api"; 

const api = axios.create({
  baseURL,
  withCredentials: true,
});

// REQUEST INTERCEPTOR
api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("adminToken");
  const authToken = localStorage.getItem("authToken");

  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  // --- NEW: LOGIC FOR FILE UPLOADS ---
  // If we are sending a file (FormData), remove the Content-Type header.
  // This lets the browser generate the correct header with the 'boundary'.
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
}, (error) => {
    return Promise.reject(error);
});

// --- NEW: RESPONSE INTERCEPTOR FOR ERROR LOGGING ---
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging to show detailed validation errors in console
    if (error.response && error.response.status === 422) {
      console.error("Validation Error:", error.response.data.errors);
    } else if (error.response) {
      console.error("API Error:", error.response.status, error.response.data);
    } else {
      console.error("Network/Server Error:", error.message);
    }
    return Promise.reject(error);
  }
);

export default api;