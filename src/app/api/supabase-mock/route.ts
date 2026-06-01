import { NextRequest, NextResponse } from 'next/server';
import { runLocalQuery } from '@/lib/sqlite-db-server';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = runLocalQuery(payload);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API Supabase Mock Error]:', err);
    return NextResponse.json(
      { data: null, error: { message: err.message || err } },
      { status: 500 }
    );
  }
}
