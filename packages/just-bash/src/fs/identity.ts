import type { IFileSystem } from "./interface.js";

/**
 * Identity registry for filesystem instances.
 *
 * Upstream keyed this registry with a `WeakMap` and tracked tokens in a
 * `WeakSet`, neither of which has a lowering in a statically compiled build.
 * The registry is kept as two parallel arrays instead. Tokens stay inert
 * objects with no prototype and no reference back to the filesystem, so
 * consumers keep the same authority guarantees.
 */
const identityOwners: IFileSystem[] = [];
const identityTokens: object[] = [];

/**
 * Return an inert identity token for a filesystem. The token deliberately has
 * no prototype or reference back to the filesystem: consumers may safely use
 * it as a registry key without acquiring filesystem authority.
 */
export function getFileSystemIdentity(fs: IFileSystem): object {
  for (let i = 0; i < identityOwners.length; i += 1) {
    if (identityOwners[i] === fs) return identityTokens[i];
  }
  const identity = Object.create(null) as object;
  identityOwners.push(fs);
  identityTokens.push(identity);
  return identity;
}

/** True only for inert tokens created by getFileSystemIdentity(). */
export function isFileSystemIdentity(value: object): boolean {
  for (let i = 0; i < identityTokens.length; i += 1) {
    if (identityTokens[i] === value) return true;
  }
  return false;
}
