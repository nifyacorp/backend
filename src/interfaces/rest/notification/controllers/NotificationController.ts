import { FastifyRequest, FastifyReply } from 'fastify';
import { NotificationService } from '../../../../core/application/notification/services/NotificationService';
import { ApiResponseBuilder } from '../../../api/ApiResponse';
import { AppError, ErrorCode } from '../../../../core/shared/errors/AppError';
import { NotificationStatus, NotificationType } from '../../../../core/domain/notification/models/NotificationEntity';

/**
 * Controller for notification management
 */
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}
  
  /**
   * Get notification by ID
   */
  async getById(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    const notification = await this.notificationService.findById(id);
    
    if (!notification) {
      throw AppError.notFound('Notification not found', ErrorCode.NOTIFICATION_NOT_FOUND);
    }
    
    // Check ownership
    if (notification.userId !== userId) {
      throw AppError.forbidden('You do not have permission to access this notification');
    }
    
    const response = ApiResponseBuilder.success(notification);
    reply.send(response);
  }
  
  /**
   * Get notifications for current user
   */
  async getByUser(request: FastifyRequest<{
    Querystring: {
      page?: number,
      limit?: number,
      sortBy?: string,
      sortDirection?: 'asc' | 'desc',
      status?: string,
      type?: string,
      isUnread?: boolean,
      subscriptionId?: string
    }
  }>, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortDirection = 'desc',
      status,
      type,
      isUnread,
      subscriptionId
    } = request.query;
    
    // Prepare filters
    const filters = {
      userId,
      status: status ? status.split(',') as NotificationStatus[] : undefined,
      type: type ? type.split(',') as NotificationType[] : undefined,
      isUnread: isUnread !== undefined ? isUnread : undefined,
      subscriptionId
    };
    
    // Prepare pagination
    const pagination = {
      page,
      limit,
      sortBy,
      sortDirection
    };
    
    const result = await this.notificationService.findWithFilters(filters, pagination);
    
    const response = ApiResponseBuilder.paginated(
      result.notifications,
      page,
      limit,
      result.total
    );
    
    reply.send(response);
  }
  
  /**
   * Get notifications by subscription ID
   */
  async getBySubscription(request: FastifyRequest<{
    Params: { subscriptionId: string },
    Querystring: {
      page?: number,
      limit?: number,
      sortBy?: string,
      sortDirection?: 'asc' | 'desc'
    }
  }>, reply: FastifyReply): Promise<void> {
    const { subscriptionId } = request.params;
    const userId = request.user.id;
    const { page = 1, limit = 10, sortBy = 'createdAt', sortDirection = 'desc' } = request.query;
    
    const result = await this.notificationService.findBySubscriptionId(
      subscriptionId, 
      userId,
      {
        page,
        limit,
        sortBy,
        sortDirection
      }
    );
    
    const response = ApiResponseBuilder.paginated(
      result.notifications,
      page,
      limit,
      result.total
    );
    
    reply.send(response);
  }
  
  /**
   * Create a new notification
   */
  async create(request: FastifyRequest<{
    Body: {
      userId: string,
      subscriptionId?: string,
      title: string,
      content: string,
      type: string,
      metadata?: Record<string, any>,
      entityId?: string,
      entityType?: string,
      priority?: number
    }
  }>, reply: FastifyReply): Promise<void> {
    // Only allow admin or system operations to create notifications manually
    // Normal users should not be able to create notifications directly
    if (!request.user || !request.user.roles?.includes('admin')) {
      throw AppError.forbidden('You do not have permission to create notifications manually');
    }
    
    const { 
      userId, 
      subscriptionId, 
      title, 
      content, 
      type, 
      metadata, 
      entityId, 
      entityType, 
      priority 
    } = request.body;
    
    const notification = await this.notificationService.create({
      userId,
      subscriptionId,
      title,
      content,
      type: type as NotificationType,
      metadata,
      entityId,
      entityType,
      priority
    });
    
    const response = ApiResponseBuilder.success(notification);
    reply.status(201).send(response);
  }
  
  /**
   * Create multiple notifications in bulk
   */
  async createBulk(request: FastifyRequest<{
    Body: {
      notifications: Array<{
        userId: string,
        subscriptionId?: string,
        title: string,
        content: string,
        type: string,
        metadata?: Record<string, any>,
        entityId?: string,
        entityType?: string,
        priority?: number
      }>
    }
  }>, reply: FastifyReply): Promise<void> {
    // Only allow admin or system operations to create notifications in bulk
    if (!request.user || !request.user.roles?.includes('admin')) {
      throw AppError.forbidden('You do not have permission to create notifications in bulk');
    }
    
    const { notifications } = request.body;
    
    const count = await this.notificationService.createBulkNotifications({
      notifications: notifications.map(n => ({
        userId: n.userId,
        subscriptionId: n.subscriptionId,
        title: n.title,
        content: n.content,
        type: n.type as NotificationType,
        metadata: n.metadata,
        entityId: n.entityId,
        entityType: n.entityType,
        priority: n.priority
      }))
    });
    
    const response = ApiResponseBuilder.success({ count });
    reply.status(201).send(response);
  }
  
  /**
   * Mark a notification as read
   */
  async markAsRead(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    const notification = await this.notificationService.markAsRead(id, userId);
    
    const response = ApiResponseBuilder.success(notification);
    reply.send(response);
  }
  
  /**
   * Mark a notification as unread
   */
  async markAsUnread(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    const notification = await this.notificationService.markAsUnread(id, userId);
    
    const response = ApiResponseBuilder.success(notification);
    reply.send(response);
  }
  
  /**
   * Mark all notifications as read
   */
  async markAllAsRead(request: FastifyRequest<{
    Body?: { ids?: string[] }
  }>, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    const ids = request.body?.ids;
    
    const count = await this.notificationService.markAllAsRead(userId, ids);
    
    const response = ApiResponseBuilder.success({ count });
    reply.send(response);
  }
  
  /**
   * Delete a notification (soft delete)
   */
  async delete(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    await this.notificationService.softDelete(id, userId);
    
    const response = ApiResponseBuilder.success({ success: true });
    reply.send(response);
  }
  
  /**
   * Delete all notifications for the current user
   */
  async deleteAll(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    
    const count = await this.notificationService.deleteAllForUser(userId);
    
    const response = ApiResponseBuilder.success({ count });
    reply.send(response);
  }
  
  /**
   * Get notification statistics for the current user
   */
  async getStatistics(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    
    const statistics = await this.notificationService.getStatistics(userId);
    
    const response = ApiResponseBuilder.success(statistics);
    reply.send(response);
  }
  
  /**
   * Get notification activity for the current user
   */
  async getActivity(request: FastifyRequest<{
    Querystring: {
      startDate?: string,
      endDate?: string
    }
  }>, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    const { startDate, endDate } = request.query;
    
    const activity = await this.notificationService.getActivity(
      userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );
    
    const response = ApiResponseBuilder.success(activity);
    reply.send(response);
  }
  
  /**
   * Get notifications for a specific entity
   */
  async getByEntity(request: FastifyRequest<{
    Querystring: {
      entityId: string,
      entityType?: string
    }
  }>, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    const { entityId, entityType } = request.query;
    
    const notifications = await this.notificationService.findByEntityId(
      entityId,
      entityType,
      userId // Only return notifications for the current user
    );
    
    const response = ApiResponseBuilder.success(notifications);
    reply.send(response);
  }
}