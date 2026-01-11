/**
 * Setup Script: Create Initial Admin User
 * 
 * This script creates the first admin user in the database.
 * Run this once after initial deployment.
 * 
 * Usage:
 *   npx ts-node scripts/setup-admin.ts
 * 
 * Or with environment variables:
 *   ADMIN_USERNAME=admin ADMIN_PASSWORD=SecurePass123 ADMIN_NAME="Admin User" npx ts-node scripts/setup-admin.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import * as readline from 'readline';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });

const MONGODB_URI = process.env.MONGODB_URI;
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);

// Password validation regex
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;

// User schema (simplified for script)
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'staff', 'volunteer'], default: 'staff' },
  name: { type: String, required: true, trim: true },
  isActive: { type: Boolean, default: true },
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date },
  lastLogin: { type: Date },
  passwordChangedAt: { type: Date },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

// Readline interface for interactive input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

function questionHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    
    const stdin = process.stdin;
    const oldRawMode = stdin.isRaw;
    
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    let password = '';
    
    const onData = (char: string) => {
      char = char.toString();
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(oldRawMode);
          stdin.pause();
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007F':
          password = password.slice(0, -1);
          process.stdout.clearLine(0);
          process.stdout.cursorTo(0);
          process.stdout.write(prompt + '*'.repeat(password.length));
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };
    
    stdin.on('data', onData);
  });
}

function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return { valid: errors.length === 0, errors };
}

async function main() {
  console.log('\n========================================');
  console.log('   Career City - Admin Setup Script');
  console.log('========================================\n');
  
  // Check for MongoDB URI
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI not found in environment variables.');
    console.error('Please ensure .env.local file exists with MONGODB_URI defined.');
    process.exit(1);
  }
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully.\n');
    
    // Check if any users exist
    const existingUserCount = await User.countDocuments();
    
    if (existingUserCount > 0) {
      console.log(`Found ${existingUserCount} existing user(s) in the database.`);
      const proceed = await question('Do you want to create another admin user? (y/n): ');
      
      if (proceed.toLowerCase() !== 'y') {
        console.log('\nSetup cancelled. Existing users preserved.');
        process.exit(0);
      }
    }
    
    // Get admin credentials
    let username = process.env.ADMIN_USERNAME;
    let password = process.env.ADMIN_PASSWORD;
    let name = process.env.ADMIN_NAME;
    let email = process.env.ADMIN_EMAIL;
    
    // Interactive mode if credentials not provided via env
    if (!username || !password || !name) {
      console.log('Please provide the admin user details:\n');
      
      username = username || await question('Username: ');
      name = name || await question('Full Name: ');
      email = email || await question('Email (optional, press Enter to skip): ');
      
      // Get password with validation
      let passwordValid = false;
      while (!passwordValid) {
        password = await questionHidden('Password: ');
        
        const validation = validatePassword(password);
        if (!validation.valid) {
          console.log('\nPassword requirements not met:');
          validation.errors.forEach(err => console.log(`  - ${err}`));
          console.log('');
        } else {
          const confirmPassword = await questionHidden('Confirm Password: ');
          if (password !== confirmPassword) {
            console.log('\nPasswords do not match. Please try again.\n');
          } else {
            passwordValid = true;
          }
        }
      }
    } else {
      // Validate password from environment
      const validation = validatePassword(password);
      if (!validation.valid) {
        console.error('\nPassword from environment does not meet requirements:');
        validation.errors.forEach(err => console.error(`  - ${err}`));
        process.exit(1);
      }
    }
    
    // Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      console.error(`\nError: Username "${username}" already exists.`);
      process.exit(1);
    }
    
    // Check if email already exists
    if (email) {
      const existingEmail = await User.findOne({ email: email.toLowerCase() });
      if (existingEmail) {
        console.error(`\nError: Email "${email}" already exists.`);
        process.exit(1);
      }
    }
    
    // Hash password
    console.log('\nCreating admin user...');
    
    // TypeScript guard - at this point password is always defined
    if (!password || !username || !name) {
      console.error('\nError: Missing required fields.');
      process.exit(1);
    }
    
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    // Create admin user
    const adminUser = await User.create({
      username: username.toLowerCase().trim(),
      password: hashedPassword,
      name: name.trim(),
      role: 'admin',
      email: email?.toLowerCase().trim() || undefined,
      isActive: true,
      failedLoginAttempts: 0,
    });
    
    console.log('\n========================================');
    console.log('   Admin User Created Successfully!');
    console.log('========================================');
    console.log(`\n  Username: ${adminUser.username}`);
    console.log(`  Name: ${adminUser.name}`);
    console.log(`  Role: ${adminUser.role}`);
    if (adminUser.email) console.log(`  Email: ${adminUser.email}`);
    console.log(`\n  You can now log in at /staff/login`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\nError during setup:', error);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

main();
