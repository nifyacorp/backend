import { Service } from '../../shared/services/Service';
import { SubscriptionEntity, SubscriptionStatus, SubscriptionType } from '../../../domain/subscription/models/SubscriptionEntity';
import { SubscriptionFilterOptions, SubscriptionPaginationOptions, SubscriptionRepositoryResult } from '../../../domain/subscription/repositories/SubscriptionRepository';

export interface CreateSubscriptionDTO {
  name: string;
  description?: string;
  type: SubscriptionType;
  filters: Record<string, any>;
  templateId?: string;
  userId: string;
}

export interface UpdateSubscriptionDTO {
  name?: string;
  description?: string;
  status?: SubscriptionStatus;
  filters?: Record<string, any>;
  templateId?: string;
}

/**
 * Service interface for subscription management
 */
export interface SubscriptionService extends Service<SubscriptionEntity, CreateSubscriptionDTO, UpdateSubscriptionDTO> {
  findByUserId(userId: string, options?: SubscriptionPaginationOptions): Promise<SubscriptionRepositoryResult>;
  
  findWithFilters(
    filters: SubscriptionFilterOptions,
    pagination?: SubscriptionPaginationOptions
  ): Promise<SubscriptionRepositoryResult>;
  
  softDelete(id: string, userId: string): Promise<boolean>;
  
  pauseSubscription(id: string, userId: string): Promise<SubscriptionEntity>;
  
  resumeSubscription(id: string, userId: string): Promise<SubscriptionEntity>;
  
  markAsProcessed(id: string, processingDate: Date): Promise<SubscriptionEntity>;
  
  findSharedSubscriptions(userId: string): Promise<SubscriptionEntity[]>;
  
  shareSubscription(subscriptionId: string, ownerUserId: string, targetUserId: string): Promise<boolean>;
  
  unshareSubscription(subscriptionId: string, ownerUserId: string, targetUserId: string): Promise<boolean>;
}