'use server';

import dbConnect from '@/lib/db';
import { Organization, IOrganization } from '@/models/Organization';
import { revalidatePath } from 'next/cache';

export async function getOrganization(organizationId: string): Promise<IOrganization | null> {
  await dbConnect();
  
  try {
    const org = await Organization.findOne({ organizationId }).lean();
    if (!org) return null;

    return {
      ...org,
      _id: org._id.toString(),
    } as unknown as IOrganization;
  } catch (error) {
    console.error('Error getting organization:', error);
    return null;
  }
}

export async function createOrganization(organization: Omit<IOrganization, 'visitors' | 'visitorCount'>): Promise<void> {
  await dbConnect();

  try {
    await Organization.create({
      ...organization,
      visitors: [],
      visitorCount: 0,
    });
    revalidatePath('/staff/organizations');
  } catch (error) {
    console.error('Error creating organization:', error);
    throw new Error('Failed to create organization');
  }
}

export async function updateOrganization(organizationId: string, data: Partial<IOrganization>): Promise<void> {
  await dbConnect();

  try {
    await Organization.findOneAndUpdate({ organizationId }, data);
    revalidatePath('/staff/organizations');
  } catch (error) {
    console.error('Error updating organization:', error);
    throw new Error('Failed to update organization');
  }
}

export async function deleteOrganization(organizationId: string): Promise<void> {
  await dbConnect();

  try {
    await Organization.findOneAndDelete({ organizationId });
    revalidatePath('/staff/organizations');
  } catch (error) {
    console.error('Error deleting organization:', error);
    throw new Error('Failed to delete organization');
  }
}

export async function getAllOrganizations(): Promise<IOrganization[]> {
  await dbConnect();

  try {
    const orgs = await Organization.find({}).lean();
    return orgs.map(org => ({
      ...org,
      _id: org._id.toString(),
    })) as unknown as IOrganization[];
  } catch (error) {
    console.error('Error getting all organizations:', error);
    return [];
  }
}

export async function getOrganizationsByIds(organizationIds: string[]): Promise<IOrganization[]> {
  await dbConnect();

  if (organizationIds.length === 0) return [];

  try {
    const orgs = await Organization.find({ organizationId: { $in: organizationIds } }).lean();
    return orgs.map(org => ({
      ...org,
      _id: org._id.toString(),
    })) as unknown as IOrganization[];
  } catch (error) {
    console.error('Error getting organizations by IDs:', error);
    return [];
  }
}
