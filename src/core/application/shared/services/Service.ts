/**
 * Generic service interface that all application services should implement
 */
export interface Service<T, CreateDTO, UpdateDTO> {
  findById(id: string | number): Promise<T | null>;
  create(dto: CreateDTO): Promise<T>;
  update(id: string | number, dto: UpdateDTO): Promise<T>;
  delete(id: string | number): Promise<boolean>;
}