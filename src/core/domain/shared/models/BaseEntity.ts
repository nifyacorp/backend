/**
 * Base entity class that all domain entities should extend
 */
export abstract class BaseEntity<T> {
  protected constructor(protected readonly props: T) {}

  public equals(entity?: BaseEntity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }
    
    if (this === entity) {
      return true;
    }
    
    return this.getEntityId() === entity.getEntityId();
  }

  /**
   * Returns the entity's unique identifier
   */
  public abstract getEntityId(): string | number;
}