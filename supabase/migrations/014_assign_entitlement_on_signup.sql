-- Assign a chosen membership tier when a new auth user is created.
-- Falls back to essential when no requested_plan is supplied.

create or replace function public.assign_member_entitlement_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_plan text;
begin
    requested_plan := lower(coalesce(new.raw_user_meta_data ->> 'requested_plan', 'essential'));

    if requested_plan not in ('premium', 'essential', 'demo') then
        requested_plan := 'essential';
    end if;

    insert into public.member_entitlements (
        user_id,
        tier,
        expires_at,
        updated_at
    )
    values (
        new.id,
        requested_plan,
        case
            when requested_plan = 'demo' then now() + interval '30 days'
            else null
        end,
        now()
    )
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created_assign_entitlement on auth.users;

create trigger on_auth_user_created_assign_entitlement
after insert on auth.users
for each row execute function public.assign_member_entitlement_on_signup();
