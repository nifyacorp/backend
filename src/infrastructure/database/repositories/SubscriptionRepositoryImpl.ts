import { getClient } from '../client';
import { AppError, ErrorCode } from '../../../core/shared/errors/AppError';
import { 
  SubscriptionRepository, 
  SubscriptionFilterOptions, 
  SubscriptionPaginationOptions, 
  SubscriptionRepositoryResult 
} from '../../../core/domain/subscription/repositories/SubscriptionRepository';
import { 
  SubscriptionEntity, 
  SubscriptionProps, 
  SubscriptionStatus,
  SubscriptionType 
} from '../../../core/domain/subscription/models/SubscriptionEntity';
import { v4 as uuidv4 } from 'uuid';

export class SubscriptionRepositoryImpl implements SubscriptionRepository {
  private readonly tableName = 'subscriptions';
  
  async findById(id: string): Promise<SubscriptionEntity | null> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .eq('status', SubscriptionStatus.DELETED, { negate: true })
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when finding subscription by ID',
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
        'Unexpected error when finding subscription by ID',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findByUserId(
    userId: string,
    options: SubscriptionPaginationOptions = {}
  ): Promise<SubscriptionRepositoryResult> {
    const client = getClient();
    const { page = 1, limit = 10, sortBy = 'created_at', sortDirection = 'desc' } = options;
    const offset = (page - 1) * limit;
    
    try {
      // Get the total count
      const { count, error: countError } = await client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', SubscriptionStatus.DELETED, { negate: true });
      
      if (countError) {
        throw new AppError(
          'Database error when counting subscriptions',
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
        .eq('status', SubscriptionStatus.DELETED, { negate: true })
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range(offset, offset + limit - 1);
      
      if (error) {
        throw new AppError(
          'Database error when finding subscriptions by user ID',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      const subscriptions = data.map(item => this.mapToEntity(item));
      
      return {
        subscriptions,
        total: count || 0
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when finding subscriptions by user ID',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findByIdAndUserId(id: string, userId: string): Promise<SubscriptionEntity | null> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .eq('status', SubscriptionStatus.DELETED, { negate: true })
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when finding subscription by ID and user ID',
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
        'Unexpected error when finding subscription by ID and user ID',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findWithFilters(
    filters: SubscriptionFilterOptions,
    pagination: SubscriptionPaginationOptions = {}
  ): Promise<SubscriptionRepositoryResult> {
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
      
      // Filter out deleted subscriptions unless explicitly requested
      if (!filters.status || !Array.isArray(filters.status) || !filters.status.includes(SubscriptionStatus.DELETED)) {
        query = query.eq('status', SubscriptionStatus.DELETED, { negate: true });
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
      
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      
      if (filters.createdAfter) {
        query = query.gte('created_at', filters.createdAfter.toISOString());
      }
      
      if (filters.createdBefore) {
        query = query.lte('created_at', filters.createdBefore.toISOString());
      }
      
      if (filters.sharedWith) {
        query = query.contains('shared_with', [filters.sharedWith]);
      }
      
      // Get the count
      const { count, error: countError } = await query;
      
      if (countError) {
        throw new AppError(
          'Database error when counting filtered subscriptions',
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
          'Database error when finding filtered subscriptions',
          ErrorCode.DATABASE_ERROR,
          500,
          error
        );
      }
      
      const subscriptions = data.map(item => this.mapToEntity(item));
      
      return {
        subscriptions,
        total: count || 0
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      throw new AppError(
        'Unexpected error when finding filtered subscriptions',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async save(entity: SubscriptionEntity): Promise<SubscriptionEntity> {
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
          'Database error when saving subscription',
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
        'Unexpected error when saving subscription',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async update(id: string, partialEntity: Partial<SubscriptionEntity>): Promise<SubscriptionEntity> {
    const client = getClient();
    
    try {
      // First get the current entity
      const current = await this.findById(id);
      
      if (!current) {
        throw AppError.notFound(
          `Subscription with ID ${id} not found`,
          ErrorCode.SUBSCRIPTION_NOT_FOUND
        );
      }
      
      // Create updated entity
      const updatedEntity = current.update(partialEntity as Partial<SubscriptionProps>);
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
          'Database error when updating subscription',
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
        'Unexpected error when updating subscription',
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
          'Database error when deleting subscription',
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
        'Unexpected error when deleting subscription',
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
        .update({ status: SubscriptionStatus.DELETED, updated_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) {
        throw new AppError(
          'Database error when soft deleting subscription',
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
        'Unexpected error when soft deleting subscription',
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
          'Database error when checking if subscription exists',
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
        'Unexpected error when checking if subscription exists',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async markAsProcessed(id: string, processingDate: Date): Promise<SubscriptionEntity> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .update({ 
          last_run_at: processingDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*')
        .single();
      
      if (error) {
        throw new AppError(
          'Database error when marking subscription as processed',
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
        'Unexpected error when marking subscription as processed',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async findSharedSubscriptions(userId: string): Promise<SubscriptionEntity[]> {
    const client = getClient();
    
    try {
      const { data, error } = await client
        .from(this.tableName)
        .select('*')
        .contains('shared_with', [userId])
        .eq('status', SubscriptionStatus.DELETED, { negate: true });
      
      if (error) {
        throw new AppError(
          'Database error when finding shared subscriptions',
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
        'Unexpected error when finding shared subscriptions',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async addSharedUser(subscriptionId: string, userId: string): Promise<boolean> {
    const client = getClient();
    
    try {
      // First get the current entity to access current shared_with
      const { data: current, error: findError } = await client
        .from(this.tableName)
        .select('shared_with')
        .eq('id', subscriptionId)
        .single();
      
      if (findError) {
        throw new AppError(
          'Database error when finding subscription for sharing',
          ErrorCode.DATABASE_ERROR,
          500,
          findError
        );
      }
      
      if (!current) {
        throw AppError.notFound(
          `Subscription with ID ${subscriptionId} not found`,
          ErrorCode.SUBSCRIPTION_NOT_FOUND
        );
      }
      
      // Create or update the shared_with array
      const sharedWith = current.shared_with || [];
      if (!sharedWith.includes(userId)) {
        sharedWith.push(userId);
      }
      
      // Update the record
      const { error } = await client
        .from(this.tableName)
        .update({ 
          shared_with: sharedWith,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);
      
      if (error) {
        throw new AppError(
          'Database error when adding shared user to subscription',
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
        'Unexpected error when adding shared user to subscription',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  async removeSharedUser(subscriptionId: string, userId: string): Promise<boolean> {
    const client = getClient();
    
    try {
      // First get the current entity to access current shared_with
      const { data: current, error: findError } = await client
        .from(this.tableName)
        .select('shared_with')
        .eq('id', subscriptionId)
        .single();
      
      if (findError) {
        throw new AppError(
          'Database error when finding subscription for unsharing',
          ErrorCode.DATABASE_ERROR,
          500,
          findError
        );
      }
      
      if (!current) {
        throw AppError.notFound(
          `Subscription with ID ${subscriptionId} not found`,
          ErrorCode.SUBSCRIPTION_NOT_FOUND
        );
      }
      
      // Remove the user from shared_with array
      const sharedWith = current.shared_with || [];
      const updatedSharedWith = sharedWith.filter(id => id !== userId);
      
      // Update the record
      const { error } = await client
        .from(this.tableName)
        .update({ 
          shared_with: updatedSharedWith,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId);
      
      if (error) {
        throw new AppError(
          'Database error when removing shared user from subscription',
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
        'Unexpected error when removing shared user from subscription',
        ErrorCode.DATABASE_ERROR,
        500,
        error
      );
    }
  }
  
  /**
   * Map database record to domain entity
   */
  private mapToEntity(data: any): SubscriptionEntity {
    return SubscriptionEntity.create({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      description: data.description,
      type: data.type as SubscriptionType,
      status: data.status as SubscriptionStatus,
      filters: data.filters,
      templateId: data.template_id,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      lastRunAt: data.last_run_at ? new Date(data.last_run_at) : undefined,
      sharedWith: data.shared_with
    });
  }
  
  /**
   * Map domain entity to database record
   */
  private mapToDatabase(entity: SubscriptionEntity): any {
    return {
      id: entity.id,
      user_id: entity.userId,
      name: entity.name,
      description: entity.description,
      type: entity.type,
      status: entity.status,
      filters: entity.filters,
      template_id: entity.templateId,
      created_at: entity.createdAt.toISOString(),
      updated_at: entity.updatedAt.toISOString(),
      last_run_at: entity.lastRunAt ? entity.lastRunAt.toISOString() : null,
      shared_with: entity.sharedWith
    };
  }
}