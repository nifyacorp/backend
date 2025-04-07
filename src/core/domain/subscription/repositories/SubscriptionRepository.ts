import { Repository } from '../../shared/repositories/Repository';
import { SubscriptionEntity, SubscriptionStatus, SubscriptionType } from '../models/SubscriptionEntity';

export interface SubscriptionFilterOptions {
  userId?: string;
  status?: SubscriptionStatus | SubscriptionStatus[];
  type?: SubscriptionType | SubscriptionType[];
  search?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  sharedWith?: string;
}

export interface SubscriptionPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface SubscriptionRepositoryResult {
  subscriptions: SubscriptionEntity[];
  total: number;
}

/**
 * Repository interface for Subscription entities
 */
export interface SubscriptionRepository extends Repository<SubscriptionEntity> {
  findByUserId(userId: string, options?: SubscriptionPaginationOptions): Promise<SubscriptionRepositoryResult>;
  
  findByIdAndUserId(id: string, userId: string): Promise<SubscriptionEntity | null>;
  
  findWithFilters(
    filters: SubscriptionFilterOptions,
    pagination?: SubscriptionPaginationOptions
  ): Promise<SubscriptionRepositoryResult>;
  
  softDelete(id: string): Promise<boolean>;
  
  markAsProcessed(id: string, processingDate: Date): Promise<SubscriptionEntity>;
  
  findSharedSubscriptions(userId: string): Promise<SubscriptionEntity[]>;
  
  addSharedUser(subscriptionId: string, userId: string): Promise<boolean>;
  
  removeSharedUser(subscriptionId: string, userId: string): Promise<boolean>;
}