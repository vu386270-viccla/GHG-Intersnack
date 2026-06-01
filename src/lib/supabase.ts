const isServer = typeof window === 'undefined';

async function executeQuery(payload: any) {
  if (isServer) {
    const { runLocalQuery } = await import(/* webpackIgnore: true */ './sqlite-db-server');
    return runLocalQuery(payload);
  } else {
    const response = await fetch('/api/supabase-mock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return response.json();
  }
}

// ── Browser Cookie Helpers ──
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() ?? null;
  return null;
}

function setCookie(name: string, val: string, days = 7) {
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${val}; expires=${date.toUTCString()}; path=/`;
}

function eraseCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;`;
}

const MOCK_USERS = [
  { id: 'usr-admin', email: 'admin@icc.com', password: 'vuhuynh123', role: 'admin' },
  { id: 'usr-minh', email: 'minh.tran@icc.com', password: 'Pass@123', role: 'viewer' },
  { id: 'usr-sang', email: 'sang.do@icc.com', password: 'Pass@123', role: 'viewer' },
  { id: 'usr-duc', email: 'duc.nguyen@icc.com', password: 'Pass@123', role: 'viewer' }
];

const authListeners = new Set<(event: string, session: any) => void>();

function getSessionObj() {
  const token = getCookie('local-auth-token');
  if (!token) return null;
  try {
    const user = JSON.parse(token);
    return { user, access_token: 'mock-access-token' };
  } catch (e) {
    return null;
  }
}

class QueryBuilder {
  private table: string;
  private selects: string = '*';
  private filters: any[] = [];
  private orderCol: string | null = null;
  private orderAsc: boolean = true;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private limitCount: number | null = null;
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payloadData: any = null;
  private onConflictCol: string = '';

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string = '*') {
    this.selects = fields;
    this.action = 'select';
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }

  in(col: string, val: any[]) {
    this.filters.push({ type: 'in', col, val });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderCol = col;
    this.orderAsc = options?.ascending !== false;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.payloadData = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.payloadData = data;
    return this;
  }

  upsert(data: any, options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payloadData = data;
    if (options?.onConflict) {
      this.onConflictCol = options.onConflict;
    }
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  async then(resolve: (value: { data: any; error: any; count?: number }) => void) {
    try {
      const res = await this.execute();
      resolve(res);
    } catch (err) {
      resolve({ data: null, error: err });
    }
  }

  async execute() {
    const payload = {
      action: this.action,
      table: this.table,
      selects: this.selects,
      filters: this.filters,
      orderCol: this.orderCol,
      orderAsc: this.orderAsc,
      rangeFrom: this.rangeFrom,
      rangeTo: this.rangeTo,
      limit: this.limitCount,
      data: this.payloadData,
      onConflict: this.onConflictCol
    };
    return executeQuery(payload);
  }
}

export const supabase = {
  from(table: string) {
    return new QueryBuilder(table);
  },

  auth: {
    async getSession(): Promise<{ data: { session: any }; error: any }> {
      const session = getSessionObj();
      return { data: { session }, error: null };
    },

    async getUser(): Promise<{ data: { user: any }; error: any }> {
      const session = getSessionObj();
      return { data: { user: session?.user ?? null }, error: null };
    },

    async signInWithPassword({ email, password }: any): Promise<{ data: any; error: any }> {
      const matched = MOCK_USERS.find(
        u => u.email === email && u.password === password
      );

      if (matched) {
        const user = {
          id: matched.id,
          email: matched.email,
          user_metadata: { role: matched.role }
        };
        const session = { user, access_token: 'mock-access-token' };
        setCookie('local-auth-token', JSON.stringify(user), 7);
        
        authListeners.forEach(listener => listener('SIGNED_IN', session));

        return { data: { user, session }, error: null };
      }

      return { data: null, error: { message: 'Invalid credentials or unauthorized access.' } };
    },

    async signOut(): Promise<{ error: any }> {
      eraseCookie('local-auth-token');
      authListeners.forEach(listener => listener('SIGNED_OUT', null));
      return { error: null };
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      authListeners.add(callback);
      const session = getSessionObj();
      
      setTimeout(() => {
        callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
      }, 0);

      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback);
            }
          }
        }
      };
    }
  }
};
