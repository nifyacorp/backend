import { BaseEntity } from '../../shared/models/BaseEntity';

export enum NotificationStatus {
  UNREAD = 'unread',
  READ = 'read',
  ARCHIVED = 'archived',
  DELETED = 'deleted'
}

export enum NotificationType {
  BOE = 'boe',
  REAL_ESTATE = 'real_estate',
  DOGA = 'doga',
  SYSTEM = 'system'
}

export interface NotificationProps {
  id: string;
  userId: string;
  subscriptionId?: string;
  title: string;
  content: string;
  type: NotificationType;
  status: NotificationStatus;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  readAt?: Date;
  entityId?: string;
  entityType?: string;
  priority?: number;
  emailSent?: boolean;
  emailSentAt?: Date;
}

export class NotificationEntity extends BaseEntity<NotificationProps> {
  private constructor(props: NotificationProps) {
    super(props);
  }

  public static create(props: NotificationProps): NotificationEntity {
    return new NotificationEntity({
      ...props,
      createdAt: props.createdAt || new Date(),
      updatedAt: props.updatedAt || new Date(),
      status: props.status || NotificationStatus.UNREAD
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

  public get subscriptionId(): string | undefined {
    return this.props.subscriptionId;
  }

  public get title(): string {
    return this.props.title;
  }

  public get content(): string {
    return this.props.content;
  }

  public get type(): NotificationType {
    return this.props.type;
  }

  public get status(): NotificationStatus {
    return this.props.status;
  }

  public get metadata(): Record<string, any> | undefined {
    return this.props.metadata;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  public get readAt(): Date | undefined {
    return this.props.readAt;
  }

  public get entityId(): string | undefined {
    return this.props.entityId;
  }

  public get entityType(): string | undefined {
    return this.props.entityType;
  }

  public get priority(): number | undefined {
    return this.props.priority;
  }

  public get emailSent(): boolean | undefined {
    return this.props.emailSent;
  }

  public get emailSentAt(): Date | undefined {
    return this.props.emailSentAt;
  }

  public markAsRead(): NotificationEntity {
    return new NotificationEntity({
      ...this.props,
      status: NotificationStatus.READ,
      readAt: new Date(),
      updatedAt: new Date()
    });
  }

  public markAsUnread(): NotificationEntity {
    return new NotificationEntity({
      ...this.props,
      status: NotificationStatus.UNREAD,
      readAt: undefined,
      updatedAt: new Date()
    });
  }

  public archive(): NotificationEntity {
    return new NotificationEntity({
      ...this.props,
      status: NotificationStatus.ARCHIVED,
      updatedAt: new Date()
    });
  }

  public delete(): NotificationEntity {
    return new NotificationEntity({
      ...this.props,
      status: NotificationStatus.DELETED,
      updatedAt: new Date()
    });
  }

  public markEmailSent(): NotificationEntity {
    return new NotificationEntity({
      ...this.props,
      emailSent: true,
      emailSentAt: new Date(),
      updatedAt: new Date()
    });
  }

  public update(props: Partial<NotificationProps>): NotificationEntity {
    return new NotificationEntity({
      ...this.props,
      ...props,
      updatedAt: new Date()
    });
  }

  public isUnread(): boolean {
    return this.props.status === NotificationStatus.UNREAD;
  }

  public isRead(): boolean {
    return this.props.status === NotificationStatus.READ;
  }

  public isArchived(): boolean {
    return this.props.status === NotificationStatus.ARCHIVED;
  }

  public isDeleted(): boolean {
    return this.props.status === NotificationStatus.DELETED;
  }
}