interface D1ResultMeta { changes?: number }
interface D1Result<T = unknown> { results: T[]; meta: D1ResultMeta }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<D1Result[]>;
}
interface R2ObjectBody {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
}
interface Queue<T> { send(message: T): Promise<void> }
interface Message<T> {
  body: T;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}
interface MessageBatch<T> { messages: Message<T>[] }
interface Ai { run(model: string, input: Record<string, unknown>): Promise<unknown> }
interface ExportedHandler<Env = unknown, QueueBody = unknown> {
  fetch?(request: Request, env: Env): Promise<Response> | Response;
  queue?(batch: MessageBatch<QueueBody>, env: Env): Promise<void> | void;
}
