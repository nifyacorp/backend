import { BaseEntity } from '../../shared/models/BaseEntity';

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  INACTIVE = 'inactive',
  DELETED = 'deleted',
  PENDING = 'pending'
}

export enum SubscriptionType {
  BOE = 'boe',
  REAL_ESTATE = 'real_estate',
  DOGA = 'doga'
}

export interface SubscriptionProps {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: SubscriptionType;
  status: SubscriptionStatus;
  filters: Record<string, any>;
  templateId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  sharedWith?: string[];
}

export class SubscriptionEntity extends BaseEntity<SubscriptionProps> {
  private constructor(props: SubscriptionProps) {
    super(props);
  }

  public static create(props: SubscriptionProps): SubscriptionEntity {
    return new SubscriptionEntity({
      ...props,
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
    });
  }

  public getEntityId(): string {
    return this.props.id;
  }

  public get id(): string {
    return this.props.id;
  }

  public get userId(): string {
    return this.props.userId;
  }

  public get name(): string {
    return this.props.name;
  }

  public get description(): string | undefined {
    return this.props.description;
  }

  public get type(): SubscriptionType {
    return this.props.type;
  }

  public get status(): SubscriptionStatus {
    return this.props.status;
  }

  public get filters(): Record<string, any> {
    return this.props.filters;
  }

  public get templateId(): string | undefined {
    return this.props.templateId;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public get lastRunAt(): Date | undefined {
    return this.props.lastRunAt;
  }

  public get sharedWith(): string[] | undefined {
    return this.props.sharedWith;
  }

  public updateStatus(status: SubscriptionStatus): SubscriptionEntity {
    return new SubscriptionEntity({
      ...this.props,
      status,
      updatedAt: new Date()
    });
  }

  public updateFilters(filters: Record<string, any>): SubscriptionEntity {
    return new SubscriptionEntity({
      ...this.props,
      filters,
      updatedAt: new Date()
    });
  }

  public updateLastRunAt(lastRunAt: Date): SubscriptionEntity {
    return new SubscriptionEntity({
      ...this.props,
      lastRunAt,
      updatedAt: new Date()
    });
  }

  public update(props: Partial<SubscriptionProps>): SubscriptionEntity {
    return new SubscriptionEntity({
      ...this.props,
      ...props,
      updatedAt: new Date()
    });
  }

  public isActive(): boolean {
    return this.props.status === SubscriptionStatus.ACTIVE;
  }

  public isPaused(): boolean {
    return this.props.status === SubscriptionStatus.PAUSED;
  }

  public isDeleted(): boolean {
    return this.props.status === SubscriptionStatus.DELETED;
  }
}