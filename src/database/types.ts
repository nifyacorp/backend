import type { Pool } from 'pg';

export interface PoolState {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export interface ExtendedPool extends Pool {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}