export interface Migration {
    id: string;
    applyPath?: string;
    rollbackPath?: string;
}