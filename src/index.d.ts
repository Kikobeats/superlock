declare type Release = () => void;
declare type Acquire = (resolve: (release: Release) => void) => void;
declare type Lock = (signal?: AbortSignal) => Promise<Release | null>;

interface LockInterface extends Lock {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function createLock(slots?: number): LockInterface;

declare type FairQueue = (signal?: AbortSignal | null, key?: unknown) => Promise<Release | null>;

interface FairQueueInterface extends FairQueue {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function createFairQueue(slots?: number): FairQueueInterface;

declare function createFairLock(slots?: number): FairQueueInterface;

interface FairLockInterface extends FairQueueInterface {}

declare type WithFairQueue = <T>(fn: () => Promise<T>, key?: unknown, signal?: AbortSignal | null) => Promise<T | undefined>;

interface WithFairQueueInterface extends WithFairQueue {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function withFairQueue(slots?: number): WithFairQueueInterface;

declare type WithLock = <T>(fn: () => Promise<T>, signal?: AbortSignal) => Promise<T | undefined>;

interface WithLockInterface extends WithLock {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function withLock(opts?: number): WithLockInterface;

export { withLock, createLock, withFairQueue, createFairQueue, createFairLock, WithLockInterface, WithFairQueueInterface, FairQueueInterface, FairLockInterface };
