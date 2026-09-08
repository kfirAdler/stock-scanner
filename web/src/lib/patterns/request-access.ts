import 'server-only';
import { NextResponse } from 'next/server';
import { getCurrentEntitlement } from '@/lib/market-access';
import { createClient } from '@/lib/supabase/server';

export async function authorizePatternRequest() {
  const entitlement = await getCurrentEntitlement();
  if (!entitlement.loggedIn) return { response: NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }), userId: null };
  if (!entitlement.canUseScreener) return { response: NextResponse.json({ code: 'SUBSCRIPTION_REQUIRED' }, { status: 403 }), userId: null };
  const session = await createClient();
  const { data: { user }, error } = await session.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ code: 'UNAUTHORIZED' }, { status: 401 }), userId: null };
  return { response: null, userId: user.id };
}
