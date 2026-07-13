declare type Release = () => void;
declare type Acquire = (resolve: (release: Release) => void) => void;
declare type Lock = (signal?: AbortSignal) => Promise<Release | null>;

interface LockInterface extends Lock {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function createLock(slots?: number): LockInterface;

declare type WithLock = <T>(fn: () => Promise<T>, signal?: AbortSignal) => Promise<T | undefined>;

interface WithLockInterface extends WithLock {
  isLocked: () => boolean;
  awaiting: () => number;
}

declare function withLock(opts?: number): WithLockInterface;

export { withLock, createLock, WithLockInterface };
