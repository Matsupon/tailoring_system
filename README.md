# Tailoring System

A comprehensive tailoring management system consisting of a web admin panel, mobile customer app, and Laravel backend API. This system allows customers to book appointments, place orders, and manage their tailoring services through a mobile app, while administrators can manage appointments, orders, and customers through a web dashboard.

## 🏗️ Project Structure

```
Admin-Tailor Full/
├── Admin-Tailor/              # React web admin panel
│   ├── BACKEND/              # Laravel API backend
│   └── src/                  # React frontend source code
├── Capstone-2-System/        # React Native mobile app (Expo)
└── appointments.sql          # Database schema and sample data
```

## 📱 Components

### 1. Admin-Tailor (Web Admin Panel)
React-based web application for administrators to manage:
- Appointments
- Orders
- Customers
- Feedback
- Service types

**Technology Stack:**
- React 19
- React Router DOM
- Axios
- React Icons

### 2. Capstone-2-System (Mobile App)
React Native mobile application built with Expo for customers to:
- Book appointments
- Place orders
- View order history
- Manage profile
- Upload design images and GCash payment proofs

**Technology Stack:**
- React Native
- Expo
- Expo Router
- React Navigation
- Axios

### 3. Backend API (Laravel)
RESTful API providing endpoints for:
- User authentication
- Appointment management
- Order processing
- Customer management
- File uploads (designs, payment proofs)

**Technology Stack:**
- Laravel (PHP)
- MySQL
- Laravel Sanctum (Authentication)

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- PHP (v8.0 or higher)
- Composer
- MySQL
- npm or yarn

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/Matsupon/tailoring_system.git
cd tailoring_system
```

#### 2. Backend Setup (Laravel API)

```bash
cd Admin-Tailor/BACKEND

# Install PHP dependencies
composer install

# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Configure database in .env file
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=tailoringsystem
# DB_USERNAME=your_username
# DB_PASSWORD=your_password

# Run migrations
php artisan migrate

# (Optional) Import sample data
mysql -u your_username -p tailoringsystem < ../../appointments.sql

# Start the server
php artisan serve
```

The API will be available at `http://localhost:8000`

#### 3. Admin Panel Setup (React Web App)

```bash
cd Admin-Tailor

# Install dependencies
npm install

# Configure API endpoint in src/api.js
# Update the baseURL to match your Laravel backend

# Start development server
npm start
```

The admin panel will be available at `http://localhost:3000`

#### 4. Mobile App Setup (React Native/Expo)

```bash
cd Capstone-2-System

# Install dependencies
npm install

# Configure API endpoint in utils/api.js
# Update the baseURL to match your Laravel backend

# Start Expo development server
npx expo start
```

Follow the Expo CLI instructions to run on:
- iOS Simulator (Mac only)
- Android Emulator
- Physical device via Expo Go app

## 📋 Features

### Customer Features (Mobile App)
- User registration and authentication
- Book appointments with preferred dates and times
- Place orders for:
  - Jersey Production
  - Custom Tailoring (Uniforms)
  - Repairs/Alterations
- Upload design images
- Upload GCash payment proof
- View appointment history
- Track order status
- Manage profile

### Admin Features (Web Panel)
- Admin authentication
- Dashboard with overview statistics
- Manage appointments (accept/reject/cancel)
- View and manage orders
- Customer management
- View customer feedback
- Service type management
- Process refunds

## 🗄️ Database

The system uses MySQL database with the following main tables:
- `users` - Customer accounts
- `admins` - Admin accounts
- `appointments` - Appointment bookings
- `orders` - Order records
- `service_types` - Available service types
- `feedback` - Customer feedback
- `notifications` - System notifications

Import the `appointments.sql` file to set up the database schema and sample data.

## 🔧 Configuration

### Backend Configuration

Edit `Admin-Tailor/BACKEND/.env`:
- Database credentials
- API settings
- File storage paths
- CORS settings

### Frontend Configuration

Update API endpoints in:
- `Admin-Tailor/src/api.js` (Admin panel)
- `Capstone-2-System/utils/api.js` (Mobile app)

## 📝 API Endpoints

### Authentication
- `POST /api/login` - User/Admin login
- `POST /api/register` - User registration
- `POST /api/logout` - Logout

### Appointments
- `GET /api/appointments` - List appointments
- `POST /api/appointments` - Create appointment
- `PUT /api/appointments/{id}` - Update appointment
- `DELETE /api/appointments/{id}` - Delete appointment

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `GET /api/orders/{id}` - Get order details

### Customers
- `GET /api/customers` - List customers
- `GET /api/customers/{id}` - Get customer details

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👥 Authors

- **Matsupon** - [GitHub](https://github.com/Matsupon)

## 🙏 Acknowledgments

- Laravel Framework
- React Community
- Expo Team
- All contributors and testers

## 📞 Support

For support, please open an issue in the GitHub repository.

---

**Note:** Make sure to configure your environment variables and API endpoints before running the applications.

