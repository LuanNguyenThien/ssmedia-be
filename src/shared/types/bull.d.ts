// src/shared/types/bull.d.ts
import 'bull';

declare module 'bull' {
  interface JobOptions {
    dependencies?: string[] | number[] | JobId[];
  }
}