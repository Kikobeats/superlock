declare type Release = () => void;
declare type Acquire = (resolve: (release: Release) => void) => void;
declare type Lock = (signal?: AbortSignal) => Promise<Release | null>;

interface LockInterface extends Lock {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function createLock(slots?: number): LockInterface;

declare type WithFairQueue = (signal?: AbortSignal | null, key?: unknown) => Promise<Release | null>;

interface WithFairQueueInterface extends WithFairQueue {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function withFairQueue(slots?: number): WithFairQueueInterface;

declare function createFairLock(slots?: number): WithFairQueueInterface;

interface FairLockInterface extends WithFairQueueInterface {}

declare type WithLock = <T>(fn: () => Promise<T>, signal?: AbortSignal) => Promise<T | undefined>;

interface WithLockInterface extends WithLock {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function withLock(opts?: number): WithLockInterface;

export { withLock, createLock, withFairQueue, createFairLock, WithLockInterface, WithFairQueueInterface, FairLockInterface };
