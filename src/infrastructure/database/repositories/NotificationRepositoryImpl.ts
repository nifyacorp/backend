import { getClient } from '../client';
import { AppError, ErrorCode } from '../../../core/shared/errors/AppError';
import { 
  NotificationRepository,
  NotificationFilterOptions,
  NotificationPaginationOptions,
  NotificationRepositoryResult,
  NotificationStatistics,
  NotificationActivity
} from '../../../core/domain/notification/repositories/NotificationRepository';
import { 
  NotificationEntity,
  NotificationProps,
  NotificationStatus,
  NotificationType
} from '../../../core/domain/notification/models/NotificationEntity';
import { v4 as uuidv4 } from 'uuid';

export class NotificationRepositoryImpl implements NotificationRepository {
  private readonly tableName = 'notifications';
  
  async findById(id: string): Promise<NotificationEntity | null> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .eq('status', NotificationStatus.DELETED, { negate: true })
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when finding notification by ID',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      if (!data) {
        return null;
      }
      
      return this.mapToEntity(data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when finding notification by ID',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findByUserId(
    userId: string,
    options: NotificationPaginationOptions = {}
  ): Promise<NotificationRepositoryResult> {
    const client = getClient();
    const { page = 1, limit = 10, sortBy = 'created_at', sortDirection = 'desc' } = options;
    const offset = (page - 1) * limit;
    
    try {
      // Get the total count
      const { count, error: countError } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', NotificationStatus.DELETED, { negate: true });
      
      if (countError) {
        throw new AppError(
          'Database error when counting notifications',
          ErrorCode.DATABASE_ERROR,
          500,
          countError
        );
      }
      
      // Get the actual data
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('user_id', userId)
        .eq('status', NotificationStatus.DELETED, { negate: true })
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range(offset, offset + limit - 1);
      
      if (error) {
        throw new AppError(
          'Database error when finding notifications by user ID',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      const notifications = data.map(item => this.mapToEntity(item));
      
      return {
        notifications,
        total: count || 0
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when finding notifications by user ID',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findBySubscriptionId(
    subscriptionId: string,
    options: NotificationPaginationOptions = {}
  ): Promise<NotificationRepositoryResult> {
    const client = getClient();
    const { page = 1, limit = 10, sortBy = 'created_at', sortDirection = 'desc' } = options;
    const offset = (page - 1) * limit;
    
    try {
      // Get the total count
      const { count, error: countError } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('subscription_id', subscriptionId)
        .eq('status', NotificationStatus.DELETED, { negate: true });
      
      if (countError) {
        throw new AppError(
          'Database error when counting notifications by subscription ID',
          ErrorCode.DATABASE_ERROR,
          500,
          countError
        );
      }
      
      // Get the actual data
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('subscription_id', subscriptionId)
        .eq('status', NotificationStatus.DELETED, { negate: true })
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range(offset, offset + limit - 1);
      
      if (error) {
        throw new AppError(
          'Database error when finding notifications by subscription ID',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      const notifications = data.map(item => this.mapToEntity(item));
      
      return {
        notifications,
        total: count || 0
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when finding notifications by subscription ID',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findWithFilters(
    filters: NotificationFilterOptions,
    pagination: NotificationPaginationOptions = {}
  ): Promise<NotificationRepositoryResult> {
    const client = getClient();
    const { page = 1, limit = 10, sortBy = 'created_at', sortDirection = 'desc' } = pagination;
    const offset = (page - 1) * limit;
    
    try {
      let query = client
        .from(this.tableName)
        .select('*', { count: 'exact' });
      
      // Apply filters
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      
      if (filters.subscriptionId) {
        query = query.eq('subscription_id', filters.subscriptionId);
      }
      
      // Filter out deleted notifications unless explicitly requested
      if (!filters.status || !Array.isArray(filters.status) || !filters.status.includes(NotificationStatus.DELETED)) {
        query = query.eq('status', NotificationStatus.DELETED, { negate: true });
      } else if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }
      
      if (filters.type) {
        if (Array.isArray(filters.type)) {
          query = query.in('type', filters.type);
        } else {
          query = query.eq('type', filters.type);
        }
      }
      
      if (filters.createdAfter) {
        query = query.gte('created_at', filters.createdAfter.toISOString());
      }
      
      if (filters.createdBefore) {
        query = query.lte('created_at', filters.createdBefore.toISOString());
      }
      
      if (filters.entityId) {
        query = query.eq('entity_id', filters.entityId);
      }
      
      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      
      if (filters.isUnread === true) {
        query = query.eq('status', NotificationStatus.UNREAD);
      } else if (filters.isUnread === false) {
        query = query.neq('status', NotificationStatus.UNREAD);
      }
      
      // Get the count
      const { count, error: countError } = await query;
      
      if (countError) {
        throw new AppError(
          'Database error when counting filtered notifications',
          ErrorCode.DATABASE_ERROR,
          500,
          countError
        );
      }
      
      // Get the actual data with pagination
      const { data, error } = await query
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range(offset, offset + limit - 1);
      
      if (error) {
        throw new AppError(
          'Database error when finding filtered notifications',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      const notifications = data.map(item => this.mapToEntity(item));
      
      return {
        notifications,
        total: count || 0
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when finding filtered notifications',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async save(entity: NotificationEntity): Promise<NotificationEntity> {
    const client = getClient();
    const data = this.mapToDatabase(entity);
    
    try {
      // Generate a new ID if not provided
      if (!data.id) {
        data.id = uuidv4();
      }
      
      const { data: insertedData, error } = await client
        .from(this.tableName)
        .insert([data])
        .select('*')
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when saving notification',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return this.mapToEntity(insertedData);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when saving notification',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async update(id: string, partialEntity: Partial<NotificationEntity>): Promise<NotificationEntity> {
    const client = getClient();
    
    try {
      // First get the current entity
      const current = await this.findById(id);
      
      if (!current) {
        throw AppError.notFound(
          `Notification with ID ${id} not found`,
          ErrorCode.NOTIFICATION_NOT_FOUND
        );
      }
      
      // Create updated entity
      const updatedEntity = current.update(partialEntity as Partial<NotificationProps>);
      const data = this.mapToDatabase(updatedEntity);
      
      // Update in database
      const { data: updatedData, error } = await client
        .from(this.tableName)
        .update(data)
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when updating notification',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return this.mapToEntity(updatedData);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when updating notification',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async delete(id: string): Promise<boolean> {
    const client = getClient();
    
    try {
      const { error } = await client
        .from(this.tableName)
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new AppError(
          'Database error when deleting notification',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when deleting notification',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async softDelete(id: string): Promise<boolean> {
    const client = getClient();
    
    try {
      const { error } = await client
        .from(this.tableName)
        .update({ 
          status: NotificationStatus.DELETED, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) {
        throw new AppError(
          'Database error when soft deleting notification',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return true;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when soft deleting notification',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async exists(id: string): Promise<boolean> {
    const client = getClient();
    
    try {
      const { count, error } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('id', id);
      
      if (error) {
        throw new AppError(
          'Database error when checking if notification exists',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return (count || 0) > 0;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when checking if notification exists',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async markAsRead(id: string): Promise<NotificationEntity> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .update({ 
          status: NotificationStatus.READ, 
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when marking notification as read',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return this.mapToEntity(data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when marking notification as read',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async markAsUnread(id: string): Promise<NotificationEntity> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .update({ 
          status: NotificationStatus.UNREAD, 
          read_at: null,
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when marking notification as unread',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return this.mapToEntity(data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when marking notification as unread',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async markAllAsRead(userId: string, ids?: string[]): Promise<number> {
    const client = getClient();
    
    try {
      let query = client
        .from(this.tableName)
        .update({ 
          status: NotificationStatus.READ, 
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .eq('status', NotificationStatus.UNREAD);
      
      // If specific IDs are provided, add them to the query
      if (ids && ids.length > 0) {
        query = query.in('id', ids);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new AppError(
          'Database error when marking all notifications as read',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return data?.length || 0;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when marking all notifications as read',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async getStatistics(userId: string): Promise<NotificationStatistics> {
    const client = getClient();
    
    try {
      // Get total count
      const { count: total, error: totalError } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', NotificationStatus.DELETED, { negate: true });
      
      if (totalError) {
        throw new AppError(
          'Database error when getting total notification count',
          ErrorCode.DATABASE_ERROR,
          500,
          totalError
        );
      }
      
      // Get unread count
      const { count: unread, error: unreadError } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', NotificationStatus.UNREAD);
      
      if (unreadError) {
        throw new AppError(
          'Database error when getting unread notification count',
          ErrorCode.DATABASE_ERROR,
          500,
          unreadError
        );
      }
      
      // Get read count
      const { count: read, error: readError } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', NotificationStatus.READ);
      
      if (readError) {
        throw new AppError(
          'Database error when getting read notification count',
          ErrorCode.DATABASE_ERROR,
          500,
          readError
        );
      }
      
      // Get archived count
      const { count: archived, error: archivedError } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', NotificationStatus.ARCHIVED);
      
      if (archivedError) {
        throw new AppError(
          'Database error when getting archived notification count',
          ErrorCode.DATABASE_ERROR,
          500,
          archivedError
        );
      }
      
      return {
        total: total || 0,
        unread: unread || 0,
        read: read || 0,
        archived: archived || 0
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when getting notification statistics',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async getActivity(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<NotificationActivity[]> {
    const client = getClient();
    
    try {
      // Query for notifications grouped by date
      let query = `
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM ${this.tableName}
        WHERE user_id = '${userId}'
      `;
      
      if (startDate) {
        query += ` AND created_at >= '${startDate.toISOString()}'`;
      }
      
      if (endDate) {
        query += ` AND created_at <= '${endDate.toISOString()}'`;
      }
      
      query += ` GROUP BY DATE(created_at) ORDER BY date DESC`;
      
      const { data, error } = await client.rpc('exec_sql', { sql: query });
      
      if (error) {
        throw new AppError(
          'Database error when getting notification activity',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return data || [];
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when getting notification activity',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async deleteAllForUser(userId: string): Promise<number> {
    const client = getClient();
    
    try {
      // Use soft delete instead of hard delete
      const { data, error } = await client
        .from(this.tableName)
        .update({ 
          status: NotificationStatus.DELETED, 
          updated_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .eq('status', NotificationStatus.DELETED, { negate: true });
      
      if (error) {
        throw new AppError(
          'Database error when deleting all notifications for user',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return data?.length || 0;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when deleting all notifications for user',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async markEmailSent(id: string): Promise<NotificationEntity> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .update({ 
          email_sent: true, 
          email_sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when marking notification email as sent',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return this.mapToEntity(data);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when marking notification email as sent',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findByEntityId(
    entityId: string,
    entityType?: string
  ): Promise<NotificationEntity[]> {
    const client = getClient();
    
    try {
      let query = client
        .from(this.tableName)
        .select('*')
        .eq('entity_id', entityId);
      
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new AppError(
          'Database error when finding notifications by entity ID',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      return data.map(item => this.mapToEntity(item));
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when finding notifications by entity ID',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  /**
   * Map database record to domain entity
   */
  private mapToEntity(data: any): NotificationEntity {
    return NotificationEntity.create({
      id: data.id,
      userId: data.user_id,
      subscriptionId: data.subscription_id,
      title: data.title,
      content: data.content,
      type: data.type as NotificationType,
      status: data.status as NotificationStatus,
      metadata: data.metadata,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      readAt: data.read_at ? new Date(data.read_at) : undefined,
      entityId: data.entity_id,
      entityType: data.entity_type,
      priority: data.priority,
      emailSent: data.email_sent,
      emailSentAt: data.email_sent_at ? new Date(data.email_sent_at) : undefined
    });
  }
  
  /**
   * Map domain entity to database record
   */
  private mapToDatabase(entity: NotificationEntity): any {
    return {
      id: entity.id,
      user_id: entity.userId,
      subscription_id: entity.subscriptionId,
      title: entity.title,
      content: entity.content,
      type: entity.type,
      status: entity.status,
      metadata: entity.metadata,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
      read_at: entity.readAt ? entity.readAt.toISOString() : null,
      entity_id: entity.entityId,
      entity_type: entity.entityType,
      priority: entity.priority,
      email_sent: entity.emailSent,
      email_sent_at: entity.emailSentAt ? entity.emailSentAt.toISOString() : null
    };
  }
}