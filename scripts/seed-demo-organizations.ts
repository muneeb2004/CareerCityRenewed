/**
 * Seed Demo Organizations
 * 
 * Run with: npx tsx scripts/seed-demo-organizations.ts
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

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI not found in environment variables');
  console.error('   Make sure .env.local exists and contains MONGODB_URI=your_connection_string');
  process.exit(1);
}

// Organization Schema (inline to avoid module resolution issues)
const OrganizationSchema = new mongoose.Schema({
  organizationId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  industry: { type: String, required: true },
  boothNumber: { type: String, required: true },
  qrCode: { type: String, required: true },
  logo: { type: String },
  contactPerson: { type: String, required: true },
  email: { type: String, required: true },
  category: { type: String, required: true },
  visitors: [{ type: String }],
  visitorCount: { type: Number, default: 0 }
}, { timestamps: true });

const Organization = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);

// Demo organizations data
const demoOrganizations = [
  {
    organizationId: "tech-solutions-inc",
    name: "Tech Solutions Inc.",
    industry: "Technology",
    boothNumber: "A1",
    qrCode: "tech-solutions-inc",
    contactPerson: "Sarah Ahmed",
    email: "careers@techsolutions.com",
    category: "Software & IT",
    visitors: [],
    visitorCount: 0
  },
  {
    organizationId: "global-consulting-group",
    name: "Global Consulting Group",
    industry: "Consulting",
    boothNumber: "B3",
    qrCode: "global-consulting-group",
    contactPerson: "Ali Khan",
    email: "hr@globalconsulting.com",
    category: "Business Services",
    visitors: [],
    visitorCount: 0
  },
  {
    organizationId: "nexgen-bank",
    name: "NexGen Bank",
    industry: "Finance",
    boothNumber: "C2",
    qrCode: "nexgen-bank",
    contactPerson: "Fatima Rizvi",
    email: "recruitment@nexgenbank.com",
    category: "Banking & Finance",
    visitors: [],
    visitorCount: 0
  },
  {
    organizationId: "creative-media-house",
    name: "Creative Media House",
    industry: "Media & Advertising",
    boothNumber: "D5",
    qrCode: "creative-media-house",
    contactPerson: "Zain Malik",
    email: "jobs@creativemedia.pk",
    category: "Marketing & Media",
    visitors: [],
    visitorCount: 0
  },
  {
    organizationId: "engro-industries",
    name: "Engro Industries",
    industry: "Manufacturing",
    boothNumber: "A4",
    qrCode: "engro-industries",
    contactPerson: "Ayesha Siddiqui",
    email: "careers@engro.com",
    category: "Engineering & Manufacturing",
    visitors: [],
    visitorCount: 0
  }
];

async function seedOrganizations() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI as string);
    console.log('✅ Connected to MongoDB');

    console.log('\n📦 Seeding demo organizations...\n');

    for (const org of demoOrganizations) {
      try {
        await Organization.findOneAndUpdate(
          { organizationId: org.organizationId },
          org,
          { upsert: true, new: true }
        );
        console.log(`  ✅ ${org.name} (Booth: ${org.boothNumber})`);
      } catch (error) {
        console.error(`  ❌ Failed to create ${org.name}:`, error);
      }
    }

    console.log('\n✅ Demo organizations seeded successfully!');
    console.log(`   Total: ${demoOrganizations.length} organizations`);

  } catch (error) {
    console.error('❌ Error seeding organizations:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the seed function
seedOrganizations();
