import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

// Route for updating selected-model cookie because setting in an action causes a refresh
export async function POST(request: NextRequest) {
  try {
    const { model } = await request.json();

    if (!model || typeof model !== 'string') {
      return NextResponse.json(
        { error: 'Invalid model parameter' },
        { status: 400 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set('chat-model', model, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to set cookie' },
      { status: 500 },
    );
  }
}
