import axios from "axios";

const baseURL =
  process.env.NODE_ENV === "development"
    ? "http://192.168.10.87:8000/api" 
    : "/api"; 

const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const adminToken = localStorage.getItem("adminToken");
  const authToken = localStorage.getItem("authToken");

  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  } else if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  return config;
});

export default api;
