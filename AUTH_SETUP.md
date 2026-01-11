# Secure Staff Authentication System Setup Guide

This guide covers the setup and configuration of the secure staff authentication system for Career City 2026.

## Overview

The authentication system provides:
- **Database-backed user management** with MongoDB
- **Bcrypt password hashing** with configurable salt rounds
- **JWT token-based sessions** with secure cookies
- **Role-based access control** (admin, staff, volunteer)
- **Account lockout protection** (5 failed attempts = 30 min lockout)
- **Comprehensive audit logging** for security monitoring

## Prerequisites

- MongoDB instance running and accessible
- Node.js 18+ installed
- Environment variables configured

## Environment Variables

Add these to your `.env.local` or `.env` file:

```bash
# Required
MONGODB_URI=mongodb://localhost:27017/career-city
JWT_SECRET=your-secure-random-secret-at-least-32-characters-long

# Optional (with defaults)
BCRYPT_ROUNDS=10                 # Salt rounds for password hashing (10-12 recommended)
JWT_EXPIRY=24h                   # Session expiry time (e.g., 1h, 24h, 7d)
SESSION_COOKIE_NAME=staff_token  # Cookie name for staff sessions
```

### Generating a Secure JWT Secret

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# OpenSSL
openssl rand -hex 64

# PowerShell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | % {[char]$_})
```

## Initial Setup

### Option 1: Web UI Setup (Recommended)

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `/staff/login`

3. If no users exist, you'll see the "Initial Admin Setup" form

4. Create your first admin account:
   - Choose a username (3-30 characters, alphanumeric with `-` and `_`)
   - Enter your name
   - Create a strong password (8+ chars, uppercase, lowercase, number)

### Option 2: Command Line Setup

Run the setup script:

```bash
# Interactive mode
npx ts-node scripts/setup-admin.ts

# With environment variables
ADMIN_USERNAME=admin ADMIN_PASSWORD=SecurePass123 npx ts-node scripts/setup-admin.ts
```

### Option 3: API Setup

Make a POST request to `/api/auth/setup`:

```bash
curl -X POST http://localhost:3000/api/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "SecurePassword123",
    "name": "Admin User",
    "email": "admin@example.com"
  }'
```

## User Management

### Admin Dashboard

Admins can manage users at `/staff/users`:
- Create new users (admin, staff, volunteer)
- Edit user details
- Activate/deactivate accounts
- Reset passwords

### API Endpoints

#### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User login |
| `/api/auth/logout` | POST | User logout |
| `/api/auth/me` | GET | Get current user |
| `/api/auth/change-password` | POST | Change password |
| `/api/auth/setup` | GET/POST | Initial admin setup |

#### User Management (Admin Only)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/users` | GET | List all users |
| `/api/admin/users` | POST | Create user |
| `/api/admin/users/[userId]` | GET | Get user details |
| `/api/admin/users/[userId]` | PUT | Update user |
| `/api/admin/users/[userId]` | DELETE | Delete user |
| `/api/admin/users/[userId]/reset-password` | POST | Reset password |

## Role Hierarchy

```
admin (3) > staff (2) > volunteer (1)
```

- **Admin**: Full system access, user management, all data
- **Staff**: Organization management, student records, analytics
- **Volunteer**: Organization feedback, student feedback

## Security Features

### Password Requirements

All passwords must meet these requirements:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)

### Account Lockout

- **5 failed login attempts** triggers account lockout
- **30-minute lockout duration**
- Lockout is tracked both by username and IP address
- Admin can unlock accounts via user management

### Session Security

- JWT tokens stored in HTTP-only, secure cookies
- Tokens expire based on `JWT_EXPIRY` setting
- Tokens are invalidated on password change
- CSRF protection via SameSite cookie attribute

### Audit Logging

All authentication events are logged:
- Login success/failure
- Logout
- Password changes
- Account lockouts
- User management actions

## Migration from Hardcoded Credentials

If upgrading from the previous hardcoded system:

1. The old `staff-credentials.json` has been renamed to `staff-credentials.DEPRECATED.json`
2. Run the setup script to create your first admin
3. Create accounts for existing staff members
4. Delete the deprecated file once migration is complete

## Troubleshooting

### "Setup required" keeps showing

- Ensure MongoDB is connected
- Check `MONGODB_URI` environment variable
- Verify database permissions

### Login fails with valid credentials

- Check if account is locked (wait 30 minutes or ask admin to unlock)
- Ensure password meets requirements
- Check for case-sensitivity in username

### "Admin access required" error

- Verify your account has the `admin` role
- Check that you're logged in
- Session may have expired; try logging in again

### Password reset not working

- Password must meet all requirements
- New password cannot be the same as current password
- Ensure you have admin privileges for resetting other users

## Database Schema

The User collection includes:

```javascript
{
  username: String,      // Unique, lowercase
  password: String,      // Bcrypt hashed
  role: String,          // 'admin', 'staff', 'volunteer'
  name: String,
  email: String,         // Optional, unique when provided
  isActive: Boolean,
  failedLoginAttempts: Number,
  lockedUntil: Date,
  lastLogin: Date,
  passwordChangedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:
- `username` (unique)
- `email` (unique, sparse)
- `role`
- `isActive`

## Security Best Practices

1. **Use strong, unique passwords** for all accounts
2. **Regularly rotate the JWT secret** in production
3. **Monitor audit logs** for suspicious activity
4. **Deactivate unused accounts** instead of deleting
5. **Use HTTPS in production** for secure cookie transmission
6. **Set appropriate BCRYPT_ROUNDS** (10-12 for balance of security/performance)
7. **Limit admin accounts** to only those who need them
