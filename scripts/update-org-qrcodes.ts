/**
 * Update Organization QR Codes
 * 
 * Updates all organizations' qrCode field to contain the full URL
 * for native camera app scanning.
 * 
 * Run with: npx tsx scripts/update-org-qrcodes.ts
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

// Manually load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = value;
      }
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI;
const APP_URL = 'https://career-city-renewed.vercel.app';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.error('   Make sure .env.local exists and contains MONGODB_URI=your_connection_string');
  process.exit(1);
}

// Organization Schema
const OrganizationSchema = new mongoose.Schema({
  organizationId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  industry: { type: String },
  boothNumber: { type: String },
  qrCode: { type: String, required: true },
  logo: { type: String },
  contactPerson: { type: String },
  email: { type: String },
  category: { type: String },
  visitors: [{ type: String }],
  visitorCount: { type: Number, default: 0 }
}, { timestamps: true });

const Organization = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);

async function updateQRCodes() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🔄 Updating QR codes to use: ${APP_URL}\n`);

    // Get all organizations
    const organizations = await Organization.find({});
    console.log(`   Found ${organizations.length} organizations\n`);

    let updated = 0;
    let skipped = 0;

    for (const org of organizations) {
      const newQRCode = `${APP_URL}/student?org=${encodeURIComponent(org.organizationId)}`;
      
      // Check if already updated
      if (org.qrCode === newQRCode) {
        console.log(`  ⏭️  ${org.name} - Already up to date`);
        skipped++;
        continue;
      }

      // Update qrCode field
      await Organization.updateOne(
        { _id: org._id },
        { $set: { qrCode: newQRCode } }
      );
      
      console.log(`  ✅ ${org.name}`);
      console.log(`     Old: ${org.qrCode}`);
      console.log(`     New: ${newQRCode}`);
      updated++;
    }

    console.log('\n' + '='.repeat(50));
    console.log(`✅ QR Code Update Complete!`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total:   ${organizations.length}`);

  } catch (error) {
    console.error('❌ Error updating QR codes:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the update function
updateQRCodes();
