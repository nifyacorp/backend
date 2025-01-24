export interface PoolState {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export interface ExtendedPool extends PgPool {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}