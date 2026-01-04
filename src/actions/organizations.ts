'use server';

import dbConnect from '@/lib/db';
import { Organization, IOrganization } from '@/models/Organization';
import { revalidatePath } from 'next/cache';
import { 
  OrganizationIdSchema, 
  CreateOrganizationSchema, 
  UpdateOrganizationSchema,
  validateOrThrow 
} from '@/lib/schemas';
import { safeEquals, sanitizeForMongo } from '@/lib/sanitize';
import { handleError } from '@/lib/error-handler';
import { logOrganizationOperation, logUnhandledError } from '@/lib/security-logger';

// Helper to serialize MongoDB documents for client components
// Converts _id to string and Date objects to ISO strings
function serializeOrg(org: any): IOrganization {
  return {
    ...org,
    _id: org._id.toString(),
    createdAt: org.createdAt?.toISOString?.() ?? org.createdAt,
    updatedAt: org.updatedAt?.toISOString?.() ?? org.updatedAt,
  } as IOrganization;
}

export async function getOrganization(organizationId: string): Promise<IOrganization | null> {
  await dbConnect();
  
  try {
    // Validate input
    const validatedOrgId = validateOrThrow(OrganizationIdSchema, organizationId);
    
    const org = await Organization.findOne({ organizationId: safeEquals(validatedOrgId) }).lean();
    if (!org) return null;

    return serializeOrg(org);
  } catch (error) {
    console.error('Error getting organization:', error);
    return null;
  }
}

export async function createOrganization(organization: Omit<IOrganization, 'visitors' | 'visitorCount'>): Promise<void> {
  await dbConnect();

  try {
    // Validate input
    const validated = validateOrThrow(CreateOrganizationSchema, organization);
    
    await Organization.create({
      ...validated,
      visitors: [],
      visitorCount: 0,
    });
    
    // Log organization creation
    await logOrganizationOperation('create', validated.organizationId, undefined, true);
    
    revalidatePath('/staff/organizations');
  } catch (error) {
    // Log failed creation
    await logOrganizationOperation('create', organization?.organizationId || 'unknown', undefined, false);
    
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function updateOrganization(organizationId: string, data: Partial<IOrganization>): Promise<void> {
  await dbConnect();

  try {
    // Validate inputs
    const validatedOrgId = validateOrThrow(OrganizationIdSchema, organizationId);
    const validatedData = validateOrThrow(UpdateOrganizationSchema, data);
    
    // Sanitize for MongoDB injection
    const sanitizedData = sanitizeForMongo(validatedData, 'update data');
    
    await Organization.findOneAndUpdate(
      { organizationId: safeEquals(validatedOrgId) }, 
      sanitizedData
    );
    
    // Log organization update
    await logOrganizationOperation('update', validatedOrgId, undefined, true);
    
    revalidatePath('/staff/organizations');
  } catch (error) {
    // Log failed update
    await logOrganizationOperation('update', organizationId, undefined, false);
    
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function deleteOrganization(organizationId: string): Promise<void> {
  await dbConnect();

  try {
    // Validate input
    const validatedOrgId = validateOrThrow(OrganizationIdSchema, organizationId);
    
    await Organization.findOneAndDelete({ organizationId: safeEquals(validatedOrgId) });
    
    // Log organization deletion
    await logOrganizationOperation('delete', validatedOrgId, undefined, true);
    
    revalidatePath('/staff/organizations');
  } catch (error) {
    // Log failed deletion
    await logOrganizationOperation('delete', organizationId, undefined, false);
    
    const handled = handleError(error);
    throw new Error(handled.message);
  }
}

export async function getAllOrganizations(): Promise<IOrganization[]> {
  await dbConnect();

  try {
    const orgs = await Organization.find({}).lean();
    return orgs.map(serializeOrg);
  } catch (error) {
    console.error('Error getting all organizations:', error);
    return [];
  }
}

export async function getOrganizationsByIds(organizationIds: string[]): Promise<IOrganization[]> {
  await dbConnect();

  if (organizationIds.length === 0) return [];

  try {
    // Validate each ID
    const validatedIds = organizationIds.map(id => validateOrThrow(OrganizationIdSchema, id));
    
    const orgs = await Organization.find({ organizationId: { $in: validatedIds } }).lean();
    return orgs.map(serializeOrg);
  } catch (error) {
    console.error('Error getting organizations by IDs:', error);
    return [];
  }
}
