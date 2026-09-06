export type Versioned<T> = {
  version: number;
  value: T;
};

export function initializeVersioned<T>(value: T): Versioned<T> {
  return {
    version: 0,
    value
  };
}

export function applyNextVersion<T>(current: Versioned<T>, nextVersion: number, value: T): Versioned<T> {
  if (nextVersion !== current.version + 1) {
    throw new Error("Out-of-order session update rejected");
  }

  return {
    version: nextVersion,
    value
  };
}

export function mergeLatestVersion<T>(current: Versioned<T>, incoming: Versioned<T>): Versioned<T> {
  return incoming.version > current.version ? incoming : current;
}
