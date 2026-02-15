import Database from 'better-sqlite3';
import { logger } from '../../utils/logger';
import type {
  ParentChunkDocument,
  ParentChunkDocumentStore,
} from './parent-chunk-store.interface';

export interface SQLiteParentChunkStoreConfig {
  dbPath: string; // File path or ':memory:' for in-memory DB
}

export class SQLiteParentChunkStore implements ParentChunkDocumentStore {
  private readonly db: Database.Database;

  private constructor(config: SQLiteParentChunkStoreConfig) {
    this.db = new Database(config.dbPath);
    this.initializeSchema();
  }

  public static create(
    config: SQLiteParentChunkStoreConfig,
  ): SQLiteParentChunkStore {
    // Validate config
    const trimmedPath = config.dbPath.trim();
    if (!trimmedPath) {
      throw new Error('dbPath must be a non-empty string');
    }

    logger.info(
      `Initializing SQLiteParentChunkStore with dbPath: ${config.dbPath}`,
    );

    return new SQLiteParentChunkStore({ ...config, dbPath: trimmedPath });
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file TEXT NOT NULL,
        parent_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        hash TEXT NOT NULL,
        synced_at INTEGER NOT NULL,
        UNIQUE(source_file, parent_index)
      );

      CREATE INDEX IF NOT EXISTS idx_source_file ON parents(source_file);
    `);

    logger.debug('SQLite schema initialized');
  }

  public insertParents(parents: Omit<ParentChunkDocument, 'id'>[]): number[] {
    if (parents.length === 0) {
      return [];
    }

    const stmt = this.db.prepare(`
      INSERT INTO parents (source_file, parent_index, content, hash, synced_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const ids: number[] = [];

    const insertMany = this.db.transaction(
      (parentsToInsert: Omit<ParentChunkDocument, 'id'>[]) => {
        for (let i = 0; i < parentsToInsert.length; i++) {
          const parent = parentsToInsert[i];
          const result = stmt.run(
            parent.sourceFile,
            parent.parentIndex,
            parent.content,
            parent.hash,
            parent.syncedAt,
          );
          ids.push(result.lastInsertRowid as number);
        }
      },
    );

    insertMany(parents);

    logger.debug(`Inserted ${parents.length} parent chunks`);

    return ids;
  }

  public updateParents(parents: ParentChunkDocument[]): void {
    if (parents.length === 0) {
      return;
    }

    const stmt = this.db.prepare(`
      UPDATE parents
      SET source_file = ?, parent_index = ?, content = ?, hash = ?, synced_at = ?
      WHERE id = ?
    `);

    const updateMany = this.db.transaction(
      (parentsToUpdate: ParentChunkDocument[]) => {
        for (let i = 0; i < parentsToUpdate.length; i++) {
          const parent = parentsToUpdate[i];
          stmt.run(
            parent.sourceFile,
            parent.parentIndex,
            parent.content,
            parent.hash,
            parent.syncedAt,
            parent.id,
          );
        }
      },
    );

    updateMany(parents);

    logger.debug(`Updated ${parents.length} parent chunks`);
  }

  public getParents(ids: number[]): ParentChunkDocument[] {
    if (ids.length === 0) {
      return [];
    }

    // Build parameterized query with dynamic placeholders
    const placeholders = ids.map(() => '?').join(',');
    const query = `
      SELECT id, source_file, parent_index, content, hash, synced_at
      FROM parents
      WHERE id IN (${placeholders})
    `;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...ids) as {
      id: number;
      source_file: string;
      parent_index: number;
      content: string;
      hash: string;
      synced_at: number;
    }[];

    return rows.map((row) => ({
      id: row.id,
      sourceFile: row.source_file,
      parentIndex: row.parent_index,
      content: row.content,
      hash: row.hash,
      syncedAt: row.synced_at,
    }));
  }

  public getParentsBySourceFile(sourceFile: string): ParentChunkDocument[] {
    const stmt = this.db.prepare(`
      SELECT id, source_file, parent_index, content, hash, synced_at
      FROM parents
      WHERE source_file = ?
      ORDER BY parent_index ASC
    `);

    const rows = stmt.all(sourceFile) as {
      id: number;
      source_file: string;
      parent_index: number;
      content: string;
      hash: string;
      synced_at: number;
    }[];

    return rows.map((row) => ({
      id: row.id,
      sourceFile: row.source_file,
      parentIndex: row.parent_index,
      content: row.content,
      hash: row.hash,
      syncedAt: row.synced_at,
    }));
  }

  public getAllSourceFileHashes(): { sourceFile: string; hash: string }[] {
    const stmt = this.db.prepare(`
      SELECT source_file, hash
      FROM parents
      WHERE parent_index = 0
    `);

    const rows = stmt.all() as {
      source_file: string;
      hash: string;
    }[];

    return rows.map((row) => ({
      sourceFile: row.source_file,
      hash: row.hash,
    }));
  }

  public deleteBySourceFile(sourceFile: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM parents
      WHERE source_file = ?
    `);

    const result = stmt.run(sourceFile);
    logger.debug(
      `Deleted ${result.changes} parent chunks for file: ${sourceFile}`,
    );
  }

  public deleteAll(): void {
    const stmt = this.db.prepare('DELETE FROM parents');
    const result = stmt.run();
    logger.debug(`Deleted all ${result.changes} parent chunks`);
  }

  public close(): void {
    this.db.close();
    logger.debug('SQLite database connection closed');
  }
}
