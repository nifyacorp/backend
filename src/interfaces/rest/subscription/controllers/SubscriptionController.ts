import { FastifyRequest, FastifyReply } from 'fastify';
import { SubscriptionService } from '../../../../core/application/subscription/services/SubscriptionService';
import { ApiResponseBuilder } from '../../../api/ApiResponse';
import { AppError, ErrorCode } from '../../../../core/shared/errors/AppError';

/**
 * Controller for subscription management
 */
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}
  
  /**
   * Get subscription by ID
   */
  async getById(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    const subscription = await this.subscriptionService.findByIdAndUserId(id, userId);
    
    if (!subscription) {
      throw AppError.notFound('Subscription not found', ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }
    
    const response = ApiResponseBuilder.success(subscription);
    reply.send(response);
  }
  
  /**
   * Get subscriptions for current user
   */
  async getByUser(request: FastifyRequest<{
    Querystring: {
      page?: number,
      limit?: number,
      sortBy?: string,
      sortDirection?: 'asc' | 'desc'
    }
  }>, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    const { page = 1, limit = 10, sortBy, sortDirection } = request.query;
    
    const result = await this.subscriptionService.findByUserId(userId, {
      page,
      limit,
      sortBy,
      sortDirection
    });
    
    const response = ApiResponseBuilder.paginated(
      result.subscriptions,
      page,
      limit,
      result.total
    );
    
    reply.send(response);
  }
  
  /**
   * Search subscriptions with filters
   */
  async search(request: FastifyRequest<{
    Querystring: {
      status?: string,
      type?: string,
      search?: string,
      createdAfter?: string,
      createdBefore?: string,
      page?: number,
      limit?: number,
      sortBy?: string,
      sortDirection?: 'asc' | 'desc'
    }
  }>, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    const { 
      status, 
      type, 
      search, 
      createdAfter, 
      createdBefore,
      page = 1, 
      limit = 10, 
      sortBy, 
      sortDirection 
    } = request.query;
    
    // Parse filters
    const filters = {
      userId,
      status: status ? status.split(',') : undefined,
      type: type ? type.split(',') : undefined,
      search,
      createdAfter: createdAfter ? new Date(createdAfter) : undefined,
      createdBefore: createdBefore ? new Date(createdBefore) : undefined,
    };
    
    const pagination = {
      page,
      limit,
      sortBy,
      sortDirection
    };
    
    const result = await this.subscriptionService.findWithFilters(filters, pagination);
    
    const response = ApiResponseBuilder.paginated(
      result.subscriptions,
      page,
      limit,
      result.total
    );
    
    reply.send(response);
  }
  
  /**
   * Create a new subscription
   */
  async create(request: FastifyRequest<{
    Body: {
      name: string,
      description?: string,
      type: string,
      filters: Record<string, any>,
      templateId?: string
    }
  }>, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    const { name, description, type, filters, templateId } = request.body;
    
    const subscription = await this.subscriptionService.create({
      userId,
      name,
      description,
      type: type as any, // Type assertion needed, should validate properly
      filters,
      templateId
    });
    
    const response = ApiResponseBuilder.success(subscription);
    reply.status(201).send(response);
  }
  
  /**
   * Update an existing subscription
   */
  async update(request: FastifyRequest<{
    Params: { id: string },
    Body: {
      name?: string,
      description?: string,
      status?: string,
      filters?: Record<string, any>,
      templateId?: string
    }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    const { name, description, status, filters, templateId } = request.body;
    
    // Check if the subscription exists and belongs to the user
    const subscription = await this.subscriptionService.findByIdAndUserId(id, userId);
    
    if (!subscription) {
      throw AppError.notFound('Subscription not found', ErrorCode.SUBSCRIPTION_NOT_FOUND);
    }
    
    const updatedSubscription = await this.subscriptionService.update(id, {
      name,
      description,
      status: status as any, // Type assertion needed, should validate properly
      filters,
      templateId
    });
    
    const response = ApiResponseBuilder.success(updatedSubscription);
    reply.send(response);
  }
  
  /**
   * Delete a subscription (soft delete)
   */
  async delete(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    await this.subscriptionService.softDelete(id, userId);
    
    const response = ApiResponseBuilder.success({ success: true });
    reply.send(response);
  }
  
  /**
   * Pause a subscription
   */
  async pause(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    const subscription = await this.subscriptionService.pauseSubscription(id, userId);
    
    const response = ApiResponseBuilder.success(subscription);
    reply.send(response);
  }
  
  /**
   * Resume a subscription
   */
  async resume(request: FastifyRequest<{
    Params: { id: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const userId = request.user.id;
    
    const subscription = await this.subscriptionService.resumeSubscription(id, userId);
    
    const response = ApiResponseBuilder.success(subscription);
    reply.send(response);
  }
  
  /**
   * Share a subscription with another user
   */
  async share(request: FastifyRequest<{
    Params: { id: string },
    Body: { targetUserId: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const { targetUserId } = request.body;
    const userId = request.user.id;
    
    await this.subscriptionService.shareSubscription(id, userId, targetUserId);
    
    const response = ApiResponseBuilder.success({ success: true });
    reply.send(response);
  }
  
  /**
   * Stop sharing a subscription with a user
   */
  async unshare(request: FastifyRequest<{
    Params: { id: string },
    Body: { targetUserId: string }
  }>, reply: FastifyReply): Promise<void> {
    const { id } = request.params;
    const { targetUserId } = request.body;
    const userId = request.user.id;
    
    await this.subscriptionService.unshareSubscription(id, userId, targetUserId);
    
    const response = ApiResponseBuilder.success({ success: true });
    reply.send(response);
  }
  
  /**
   * Get subscriptions shared with the current user
   */
  async getShared(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const userId = request.user.id;
    
    const subscriptions = await this.subscriptionService.findSharedSubscriptions(userId);
    
    const response = ApiResponseBuilder.success(subscriptions);
    reply.send(response);
  }
}