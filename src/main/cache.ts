/**
 * Cache Manager for Git Operations
 * Implements memory-efficient caching with LRU eviction and TTL
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
}

interface CacheConfig {
  maxSize: number; // Maximum cache size in MB
  maxAge: number; // Maximum age in milliseconds
  maxEntries: number; // Maximum number of cached items per repository
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private currentSize: number = 0; // Current cache size in bytes

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      maxSize: config?.maxSize ?? 100, // 100 MB default
      maxAge: config?.maxAge ?? 5 * 60 * 1000, // 5 minutes default
      maxEntries: config?.maxEntries ?? 50, // 50 items per repo default
    };

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Generate cache key from repository path and operation
   */
  private getCacheKey(repoPath: string, operation: string, params?: any): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${repoPath}::${operation}::${paramStr}`;
  }

  /**
   * Estimate size of data in bytes
   */
  private estimateSize(data: any): number {
    const str = JSON.stringify(data);
    return str.length * 2; // Rough estimate: 2 bytes per character
  }

  /**
   * Get cached data
   */
  get<T>(repoPath: string, operation: string, params?: any): T | null {
    const key = this.getCacheKey(repoPath, operation, params);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry is expired
    const now = Date.now();
    if (now - entry.timestamp > this.config.maxAge) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;

    return entry.data as T;
  }

  /**
   * Set cached data
   */
  set<T>(repoPath: string, operation: string, data: T, params?: any): void {
    const key = this.getCacheKey(repoPath, operation, params);
    const size = this.estimateSize(data);
    const now = Date.now();

    // Check if adding this entry would exceed memory limit
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;
    if (this.currentSize + size > maxSizeBytes) {
      this.evictLRU(size);
    }

    // Remove old entry if exists
    const oldEntry = this.cache.get(key);
    if (oldEntry) {
      this.currentSize -= oldEntry.size;
    }

    // Add new entry
    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size,
    });

    this.currentSize += size;
  }

  /**
   * Evict least recently used entries to free up space
   */
  private evictLRU(requiredSpace: number): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    let freedSpace = 0;
    const maxSizeBytes = this.config.maxSize * 1024 * 1024;

    for (const [key, entry] of entries) {
      if (this.currentSize - freedSpace + requiredSpace <= maxSizeBytes) {
        break;
      }

      this.cache.delete(key);
      freedSpace += entry.size;
      this.currentSize -= entry.size;
    }
  }

  /**
   * Invalidate cache for specific repository
   */
  invalidate(repoPath: string, operation?: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(repoPath)) {
        if (!operation || key.includes(`::${operation}::`)) {
          keysToDelete.push(key);
        }
      }
    }

    for (const key of keysToDelete) {
      const entry = this.cache.get(key);
      if (entry) {
        this.currentSize -= entry.size;
      }
      this.cache.delete(key);
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      sizeBytes: this.currentSize,
      sizeMB: (this.currentSize / (1024 * 1024)).toFixed(2),
      maxSizeMB: this.config.maxSize,
    };
  }

  /**
   * Periodic cleanup of expired entries
   */
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.config.maxAge) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        const entry = this.cache.get(key);
        if (entry) {
          this.currentSize -= entry.size;
        }
        this.cache.delete(key);
      }

      // Log cleanup results if any entries were removed
      if (keysToDelete.length > 0) {
        console.log(`Cache cleanup: removed ${keysToDelete.length} expired entries`);
      }
    }, 60 * 1000); // Run every minute
  }
}

// Global cache instance
export const gitCache = new CacheManager({
  maxSize: 100, // 100 MB
  maxAge: 5 * 60 * 1000, // 5 minutes
  maxEntries: 50,
});
