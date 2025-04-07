import { Service } from '../../shared/services/Service';
import { 
  NotificationEntity, 
  NotificationStatus, 
  NotificationType 
} from '../../../domain/notification/models/NotificationEntity';
import { 
  NotificationFilterOptions, 
  NotificationPaginationOptions, 
  NotificationRepositoryResult,
  NotificationStatistics,
  NotificationActivity
} from '../../../domain/notification/repositories/NotificationRepository';

export interface CreateNotificationDTO {
  userId: string;
  subscriptionId?: string;
  title: string;
  content: string;
  type: NotificationType;
  metadata?: Record<string, any>;
  entityId?: string;
  entityType?: string;
  priority?: number;
}

export interface UpdateNotificationDTO {
  title?: string;
  content?: string;
  status?: NotificationStatus;
  metadata?: Record<string, any>;
  priority?: number;
}

export interface CreateBulkNotificationsDTO {
  notifications: CreateNotificationDTO[];
}

/**
 * Service interface for notification management
 */
export interface NotificationService extends Service<NotificationEntity, CreateNotificationDTO, UpdateNotificationDTO> {
  findByUserId(
    userId: string,
    options?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult>;
  
  findBySubscriptionId(
    subscriptionId: string,
    userId: string,
    options?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult>;
  
  findWithFilters(
    filters: NotificationFilterOptions,
    pagination?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult>;
  
  markAsRead(id: string, userId: string): Promise<NotificationEntity>;
  
  markAsUnread(id: string, userId: string): Promise<NotificationEntity>;
  
  markAllAsRead(userId: string, ids?: string[]): Promise<number>;
  
  getStatistics(userId: string): Promise<NotificationStatistics>;
  
  getActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationActivity[]>;
  
  softDelete(id: string, userId: string): Promise<boolean>;
  
  deleteAllForUser(userId: string): Promise<number>;
  
  createBulkNotifications(dto: CreateBulkNotificationsDTO): Promise<number>;
  
  markEmailSent(id: string): Promise<NotificationEntity>;
  
  findByEntityId(
    entityId: string,
    entityType?: string,
    userId?: string
  ): Promise<NotificationEntity[]>;
}