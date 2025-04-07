import { v4 as uuidv4 } from 'uuid';
import { 
  SubscriptionService,
  CreateSubscriptionDTO,
  UpdateSubscriptionDTO
} from './SubscriptionService';
import { 
  SubscriptionEntity, 
  SubscriptionStatus,
  SubscriptionProps
} from '../../../domain/subscription/models/SubscriptionEntity';
import { 
  SubscriptionRepository,
  SubscriptionFilterOptions,
  SubscriptionPaginationOptions,
  SubscriptionRepositoryResult
} from '../../../domain/subscription/repositories/SubscriptionRepository';
import { AppError, ErrorCode } from '../../../shared/errors/AppError';

export class SubscriptionServiceImpl implements SubscriptionService {
  constructor(private readonly repository: SubscriptionRepository) {}
  
  async findById(id: string): Promise<SubscriptionEntity | null> {
    return this.repository.findById(id);
  }
  
  async findByUserId(
    userId: string,
    options?: SubscriptionPaginationOptions
  ): Promise<SubscriptionRepositoryResult> {
    return this.repository.findByUserId(userId, options);
  }
  
  async findWithFilters(
    filters: SubscriptionFilterOptions,
    pagination?: SubscriptionPaginationOptions
  ): Promise<SubscriptionRepositoryResult> {
    return this.repository.findWithFilters(filters, pagination);
  }
  
  async create(dto: CreateSubscriptionDTO): Promise<SubscriptionEntity> {
    const subscription = SubscriptionEntity.create({
      id: uuidv4(),
      userId: dto.userId,
      name: dto.name,
      description: dto.description,
      type: dto.type,
      status: SubscriptionStatus.ACTIVE, // Default status is active
      filters: dto.filters,
      templateId: dto.templateId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    return this.repository.save(subscription);
  }
  
  async update(id: string, dto: UpdateSubscriptionDTO): Promise<SubscriptionEntity> {
    const subscription = await this.repository.findById(id);
    
    if (!subscription) {
      throw AppError.notFound(
        `Subscription with ID ${id} not found`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    // Create an updated entity with the new values
    const updatedSubscription = subscription.update(dto as Partial<SubscriptionProps>);
    
    return this.repository.update(id, updatedSubscription);
  }
  
  async delete(id: string): Promise<boolean> {
    // Check if the subscription exists
    const exists = await this.repository.exists(id);
    
    if (!exists) {
      throw AppError.notFound(
        `Subscription with ID ${id} not found`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    return this.repository.delete(id);
  }
  
  async softDelete(id: string, userId: string): Promise<boolean> {
    // Check if the subscription exists and belongs to the user
    const subscription = await this.repository.findByIdAndUserId(id, userId);
    
    if (!subscription) {
      throw AppError.notFound(
        `Subscription with ID ${id} not found for user ${userId}`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    return this.repository.softDelete(id);
  }
  
  async pauseSubscription(id: string, userId: string): Promise<SubscriptionEntity> {
    // Check if the subscription exists and belongs to the user
    const subscription = await this.repository.findByIdAndUserId(id, userId);
    
    if (!subscription) {
      throw AppError.notFound(
        `Subscription with ID ${id} not found for user ${userId}`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    // Update the status to paused
    return this.repository.update(id, subscription.updateStatus(SubscriptionStatus.PAUSED));
  }
  
  async resumeSubscription(id: string, userId: string): Promise<SubscriptionEntity> {
    // Check if the subscription exists and belongs to the user
    const subscription = await this.repository.findByIdAndUserId(id, userId);
    
    if (!subscription) {
      throw AppError.notFound(
        `Subscription with ID ${id} not found for user ${userId}`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    // Update the status to active
    return this.repository.update(id, subscription.updateStatus(SubscriptionStatus.ACTIVE));
  }
  
  async markAsProcessed(id: string, processingDate: Date): Promise<SubscriptionEntity> {
    const subscription = await this.repository.findById(id);
    
    if (!subscription) {
      throw AppError.notFound(
        `Subscription with ID ${id} not found`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    return this.repository.markAsProcessed(id, processingDate);
  }
  
  async findSharedSubscriptions(userId: string): Promise<SubscriptionEntity[]> {
    return this.repository.findSharedSubscriptions(userId);
  }
  
  async shareSubscription(
    subscriptionId: string,
    ownerUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    // Check if the subscription exists and belongs to the owner
    const subscription = await this.repository.findByIdAndUserId(subscriptionId, ownerUserId);
    
    if (!subscription) {
      throw AppError.notFound(
        `Subscription with ID ${subscriptionId} not found for user ${ownerUserId}`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    // Don't allow sharing with the owner
    if (ownerUserId === targetUserId) {
      throw AppError.validation(
        'Cannot share subscription with yourself'
      );
    }
    
    return this.repository.addSharedUser(subscriptionId, targetUserId);
  }
  
  async unshareSubscription(
    subscriptionId: string,
    ownerUserId: string,
    targetUserId: string
  ): Promise<boolean> {
    // Check if the subscription exists and belongs to the owner
    const subscription = await this.repository.findByIdAndUserId(subscriptionId, ownerUserId);
    
    if (!subscription) {
      throw AppError.notFound(
        `Subscription with ID ${subscriptionId} not found for user ${ownerUserId}`,
        ErrorCode.SUBSCRIPTION_NOT_FOUND
      );
    }
    
    return this.repository.removeSharedUser(subscriptionId, targetUserId);
  }
}