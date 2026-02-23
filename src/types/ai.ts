import type { Task, TaskType } from './worksheet';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
    role: ChatRole;
    content: string;
}

export interface TaskRevisionUpdateOperation {
    action: 'update_task';
    taskId: string;
    updates: Omit<Task, 'id'>;
}

export interface TaskRevisionAddOperation {
    action: 'add_task';
    type: TaskType;
    payload?: Omit<Task, 'id'>;
}

export interface TaskRevisionResult {
    assistantMessage: string;
    operations: Array<TaskRevisionUpdateOperation | TaskRevisionAddOperation>;
}
