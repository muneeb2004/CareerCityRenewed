import mongoose, { Schema, model, models, Document } from 'mongoose';

/**
 * User Model
 * Stores staff, admin, and volunteer user accounts with hashed passwords.
 * Used for authentication instead of hardcoded credentials.
 */

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  username: string;
  email?: string;
  password: string;  // bcrypt hashed
  role: 'admin' | 'staff' | 'volunteer';
  name: string;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLogin?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Password validation regex
// Minimum 8 characters, at least one uppercase, one lowercase, one number
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false, // Optional
};

const UserSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
      match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'],
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Don't include password by default in queries
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'volunteer'],
      default: 'staff',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockedUntil: {
      type: Date,
    },
    lastLogin: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

// Instance method to check if account is locked
UserSchema.methods.isLocked = function(): boolean {
  if (!this.lockedUntil) return false;
  return this.lockedUntil > new Date();
};

// Static method to find user by username (with password)
UserSchema.statics.findByUsernameWithPassword = function(username: string) {
  return this.findOne({ username: username.toLowerCase() }).select('+password');
};

// Virtual for full user info (without password)
UserSchema.set('toJSON', {
  virtuals: true,
  transform: function(_doc, ret) {
    const obj = ret as { password?: string; __v?: number };
    delete obj.password;
    delete obj.__v;
    return ret;
  },
});

export const User = models.User || model<IUser>('User', UserSchema);
