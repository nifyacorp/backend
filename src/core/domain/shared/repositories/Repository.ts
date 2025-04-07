/**
 * Generic repository interface that all domain repositories should implement
 */
export interface Repository<T> {
  findById(id: string | number): Promise<T | null>;
  save(entity: T): Promise<T>;
  update(id: string | number, entity: Partial<T>): Promise<T>;
  delete(id: string | number): Promise<boolean>;
  exists(id: string | number): Promise<boolean>;
}