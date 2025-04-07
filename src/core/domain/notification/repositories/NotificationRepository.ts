import { Repository } from '../../shared/repositories/Repository';
import { NotificationEntity, NotificationStatus, NotificationType } from '../models/NotificationEntity';

export interface NotificationFilterOptions {
  userId?: string;
  subscriptionId?: string;
  status?: NotificationStatus | NotificationStatus[];
  type?: NotificationType | NotificationType[];
  createdAfter?: Date;
  createdBefore?: Date;
  entityId?: string;
  entityType?: string;
  isUnread?: boolean;
}

export interface NotificationPaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface NotificationRepositoryResult {
  notifications: NotificationEntity[];
  total: number;
}

export interface NotificationStatistics {
  total: number;
  unread: number;
  read: number;
  archived: number;
}

export interface NotificationActivity {
  date: string;
  count: number;
}

/**
 * Repository interface for Notification entities
 */
export interface NotificationRepository extends Repository<NotificationEntity> {
  findByUserId(
    userId: string, 
    options?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult>;
  
  findBySubscriptionId(
    subscriptionId: string,
    options?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult>;
  
  findWithFilters(
    filters: NotificationFilterOptions,
    pagination?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult>;
  
  markAsRead(id: string): Promise<NotificationEntity>;
  
  markAsUnread(id: string): Promise<NotificationEntity>;
  
  markAllAsRead(userId: string, ids?: string[]): Promise<number>;
  
  getStatistics(userId: string): Promise<NotificationStatistics>;
  
  getActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationActivity[]>;
  
  softDelete(id: string): Promise<boolean>;
  
  deleteAllForUser(userId: string): Promise<number>;
  
  markEmailSent(id: string): Promise<NotificationEntity>;
  
  findByEntityId(
    entityId: string,
    entityType?: string
  ): Promise<NotificationEntity[]>;
}