-- Expand membership tiers so access can be managed directly from Supabase.
-- premium: full access
-- essential: screener + saved scans
-- demo: full access until expires_at

alter table public.member_entitlements
    add column if not exists expires_at timestamptz;

alter table public.member_entitlements
    drop constraint if exists member_entitlements_tier_check;

alter table public.member_entitlements
    add constraint member_entitlements_tier_check
        check (tier in ('free', 'premium', 'essential', 'demo'));

alter table public.member_entitlements
    drop constraint if exists member_entitlements_demo_requires_expiry;

alter table public.member_entitlements
    add constraint member_entitlements_demo_requires_expiry
        check (tier <> 'demo' or expires_at is not null);

comment on table public.member_entitlements is
    'Access tier for market data and screener features. Demo rows must include expires_at.';
