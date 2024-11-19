declare type Release = () => void;
declare type Acquire = (resolve: (release: Release) => void) => void;
declare type Lock = () => Promise<Release>;

interface LockInterface extends Lock {
  isLocked: () => boolean;
}

declare function createLock(slots?: number): LockInterface;

declare type WithLock = <T>(fn: () => Promise<T>) => Promise<T>;

interface WithLockInterface extends WithLock {
  isLocked: () => boolean;
}

declare function withLock(opts?: number): WithLockInterface;

export { withLock, createLock, WithLockInterface };
