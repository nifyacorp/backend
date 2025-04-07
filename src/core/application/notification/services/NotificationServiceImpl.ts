import { v4 as uuidv4 } from 'uuid';
import { 
  NotificationService,
  CreateNotificationDTO,
  UpdateNotificationDTO,
  CreateBulkNotificationsDTO
} from './NotificationService';
import { 
  NotificationEntity,
  NotificationProps,
  NotificationStatus
} from '../../../domain/notification/models/NotificationEntity';
import { 
  NotificationRepository,
  NotificationFilterOptions,
  NotificationPaginationOptions,
  NotificationRepositoryResult,
  NotificationStatistics,
  NotificationActivity
} from '../../../domain/notification/repositories/NotificationRepository';
import { AppError, ErrorCode } from '../../../shared/errors/AppError';

export class NotificationServiceImpl implements NotificationService {
  constructor(private readonly repository: NotificationRepository) {}
  
  async findById(id: string): Promise<NotificationEntity | null> {
    return this.repository.findById(id);
  }
  
  async findByUserId(
    userId: string,
    options?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult> {
    return this.repository.findByUserId(userId, options);
  }
  
  async findBySubscriptionId(
    subscriptionId: string,
    userId: string,
    options?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult> {
    // Apply user filter to ensure user can only see their own notifications
    const filters: NotificationFilterOptions = {
      subscriptionId,
      userId
    };
    
    return this.repository.findWithFilters(filters, options);
  }
  
  async findWithFilters(
    filters: NotificationFilterOptions,
    pagination?: NotificationPaginationOptions
  ): Promise<NotificationRepositoryResult> {
    return this.repository.findWithFilters(filters, pagination);
  }
  
  async create(dto: CreateNotificationDTO): Promise<NotificationEntity> {
    const notification = NotificationEntity.create({
      id: uuidv4(),
      userId: dto.userId,
      subscriptionId: dto.subscriptionId,
      title: dto.title,
      content: dto.content,
      type: dto.type,
      status: NotificationStatus.UNREAD,
      metadata: dto.metadata,
      entityId: dto.entityId,
      entityType: dto.entityType,
      priority: dto.priority,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return this.repository.save(notification);
  }
  
  async update(id: string, dto: UpdateNotificationDTO): Promise<NotificationEntity> {
    const notification = await this.repository.findById(id);
    
    if (!notification) {
      throw AppError.notFound(
        `Notification with ID ${id} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }
    
    // Create an updated entity with the new values
    const updatedNotification = notification.update(dto as Partial<NotificationProps>);
    
    return this.repository.update(id, updatedNotification);
  }
  
  async delete(id: string): Promise<boolean> {
    // Check if the notification exists
    const exists = await this.repository.exists(id);
    
    if (!exists) {
      throw AppError.notFound(
        `Notification with ID ${id} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }
    
    return this.repository.delete(id);
  }
  
  async softDelete(id: string, userId: string): Promise<boolean> {
    // Find the notification and check ownership
    const notification = await this.repository.findById(id);
    
    if (!notification) {
      throw AppError.notFound(
        `Notification with ID ${id} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }
    
    if (notification.userId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to delete this notification'
      );
    }
    
    return this.repository.softDelete(id);
  }
  
  async markAsRead(id: string, userId: string): Promise<NotificationEntity> {
    // Find the notification and check ownership
    const notification = await this.repository.findById(id);
    
    if (!notification) {
      throw AppError.notFound(
        `Notification with ID ${id} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }
    
    if (notification.userId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to mark this notification as read'
      );
    }
    
    // Already read, return as is
    if (notification.isRead()) {
      return notification;
    }
    
    return this.repository.markAsRead(id);
  }
  
  async markAsUnread(id: string, userId: string): Promise<NotificationEntity> {
    // Find the notification and check ownership
    const notification = await this.repository.findById(id);
    
    if (!notification) {
      throw AppError.notFound(
        `Notification with ID ${id} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }
    
    if (notification.userId !== userId) {
      throw AppError.forbidden(
        'You do not have permission to mark this notification as unread'
      );
    }
    
    // Already unread, return as is
    if (notification.isUnread()) {
      return notification;
    }
    
    return this.repository.markAsUnread(id);
  }
  
  async markAllAsRead(userId: string, ids?: string[]): Promise<number> {
    return this.repository.markAllAsRead(userId, ids);
  }
  
  async getStatistics(userId: string): Promise<NotificationStatistics> {
    return this.repository.getStatistics(userId);
  }
  
  async getActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationActivity[]> {
    return this.repository.getActivity(userId, startDate, endDate);
  }
  
  async deleteAllForUser(userId: string): Promise<number> {
    return this.repository.deleteAllForUser(userId);
  }
  
  async createBulkNotifications(dto: CreateBulkNotificationsDTO): Promise<number> {
    if (!dto.notifications || dto.notifications.length === 0) {
      return 0;
    }
    
    // Create notifications one by one
    // In a real implementation, this could be optimized with a batch insert
    const createPromises = dto.notifications.map(notification => this.create(notification));
    
    const results = await Promise.all(createPromises);
    
    return results.length;
  }
  
  async markEmailSent(id: string): Promise<NotificationEntity> {
    const notification = await this.repository.findById(id);
    
    if (!notification) {
      throw AppError.notFound(
        `Notification with ID ${id} not found`,
        ErrorCode.NOTIFICATION_NOT_FOUND
      );
    }
    
    return this.repository.markEmailSent(id);
  }
  
  async findByEntityId(
    entityId: string,
    entityType?: string,
    userId?: string
  ): Promise<NotificationEntity[]> {
    // Get notifications by entity
    const notifications = await this.repository.findByEntityId(entityId, entityType);
    
    // If userId is provided, filter by userId
    if (userId) {
      return notifications.filter(notification => notification.userId === userId);
    }
    
    return notifications;
  }
}