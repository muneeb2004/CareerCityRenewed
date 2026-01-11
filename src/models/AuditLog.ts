import mongoose, { Schema, model, models } from 'mongoose';

/**
 * AuditLog Model
 * Tracks security-relevant actions for compliance and monitoring
 */
export interface IAuditLog {
  _id: mongoose.Types.ObjectId;
  action: 'import' | 'validate' | 'download_ids' | 'scan' | 'login' | 'logout' | 'access_denied' | 'rate_limit' | 'suspicious_activity';
  userId?: string;
  userRole?: string;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  details: Record<string, unknown>;
  success: boolean;
  resourceType?: string;
  resourceId?: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { 
      type: String, 
      required: true,
      enum: ['import', 'validate', 'download_ids', 'scan', 'login', 'logout', 'access_denied', 'rate_limit', 'suspicious_activity'],
      index: true
    },
    userId: { type: String, index: true },
    userRole: { type: String },
    ipAddress: { type: String, required: true, index: true },
    userAgent: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    details: { type: Schema.Types.Mixed, default: {} },
    success: { type: Boolean, required: true, index: true },
    resourceType: { type: String },
    resourceId: { type: String },
  },
  { 
    timestamps: false,
    // Capped collection to automatically remove old logs (keep ~100MB)
    // capped: { size: 104857600, max: 500000 }
  }
);

// Compound indexes for common queries
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, timestamp: -1 });
AuditLogSchema.index({ ipAddress: 1, action: 1, timestamp: -1 }); // For suspicious activity detection

// TTL index to auto-delete logs older than 90 days
AuditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const AuditLog = models.AuditLog || model<IAuditLog>('AuditLog', AuditLogSchema);
