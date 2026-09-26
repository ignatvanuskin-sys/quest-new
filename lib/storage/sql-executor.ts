/**
 * Тонкий слой доступа к SQL.
 *
 * Зачем отдельный интерфейс: сам драйвер (`pg`) — необязательная зависимость.
 * Если база не настроена, приложение обязано продолжать работать на файловом
 * хранилище, а не падать на импорте. Поэтому драйвер подключается динамически,
 * а весь код репозитория зависит только от этого интерфейса — его же
 * используют тесты с поддельным исполнителем, чтобы проверять SQL без базы.
 */

export interface SqlQueryResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount: number;
}

export interface SqlExecutor {
  query<Row = Record<string, unknown>>(text: string, params?: unknown[]): Promise<SqlQueryResult<Row>>;
}

export interface SqlClient extends SqlExecutor {
  /** Начать транзакцию и получить исполнителя внутри неё */
  transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

interface PgPoolLike {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
  connect: () => Promise<{
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
    release: () => void;
  }>;
  end: () => Promise<void>;
}

/**
 * Создать клиент по строке подключения.
 *
 * Возвращает `null`, если драйвер не установлен — вызывающий код в этом
 * случае честно сообщает, что база недоступна, и продолжает работу
 * на резервном хранилище.
 */
type PoolConstructor = new (config: { connectionString: string; max?: number }) => PgPoolLike;

export async function createSqlClient(connectionString: string): Promise<SqlClient | null> {
  let PoolConstructor: PoolConstructor;

  try {
    /* Имя модуля берём из переменной, а не пишем литералом: так сборщик не
       пытается включить `pg` в бандл (драйвер не в зависимостях по умолчанию —
       без базы он не нужен), а TypeScript не требует установленных типов. */
    const driverName = "pg";
    const imported = (await import(/* webpackIgnore: true */ driverName)) as unknown as {
      default?: { Pool?: PoolConstructor };
      Pool?: PoolConstructor;
    };
    const candidate = imported.default?.Pool ?? imported.Pool;
    if (!candidate) return null;
    PoolConstructor = candidate;
  } catch {
    return null;
  }

  const pool = new PoolConstructor({ connectionString, max: 10 });

  const wrap = (
    run: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>,
  ): SqlExecutor => ({
    async query<Row>(text: string, params?: unknown[]) {
      const result = await run(text, params);
      return {
        rows: result.rows as Row[],
        rowCount: result.rowCount ?? result.rows.length,
      };
    },
  });

  return {
    query: (text, params) => wrap((t, p) => pool.query(t, p)).query(text, params),
    async transaction<T>(task: (tx: SqlExecutor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const tx = wrap((text, params) => client.query(text, params));
      try {
        await client.query("BEGIN");
        const result = await task(tx);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
