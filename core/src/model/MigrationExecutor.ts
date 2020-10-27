export interface MigrationExecutor {
    executeMigration: (migrationSet: { id: string, apply: string, rollback: string }[]) => Promise<void>;
}