import React from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Orders from './pages/Orders';
import OrdersHistory from './pages/OrdersHistory';
import Customers from './pages/Customers';
import Feedback from './pages/Feedback';
import Profile from './pages/Profile';
import ServiceTypes from './pages/ServiceTypes';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />

          {/* Admin layout with persistent Header and Sidebar */}
          <Route
            element={
              <div className="dashboard-layout">
                <Sidebar />
                <div className="main-content">
                  <Header />
                  <Outlet />
                </div>
              </div>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders-history" element={<OrdersHistory />} />
            <Route path="/service-types" element={<ServiceTypes />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;