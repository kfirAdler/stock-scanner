-- One user-wide request every two hours, independent of pattern and market.
-- Only the authenticated web backend and background worker may call these RPCs.
create table public.pattern_scan_jobs (
  id uuid primary key default gen_random_uuid(),
  pattern text not null check (pattern in ('ascending_triangle', 'channel', 'cup_and_handle')),
  market text not null check (market in ('US', 'TA')),
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  lease_id uuid,
  lease_expires_at timestamptz,
  attempts integer not null default 0,
  summary jsonb,
  result jsonb
);
create index pattern_scan_jobs_lookup_idx on public.pattern_scan_jobs(pattern, market, created_at desc);
create index pattern_scan_jobs_queue_idx on public.pattern_scan_jobs(status, created_at);

create table public.pattern_scan_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  next_allowed_at timestamptz not null,
  job_id uuid references public.pattern_scan_jobs(id) on delete set null
);
alter table public.pattern_scan_jobs enable row level security;
alter table public.pattern_scan_requests enable row level security;
revoke all on public.pattern_scan_jobs, public.pattern_scan_requests from anon, authenticated;
grant all on public.pattern_scan_jobs, public.pattern_scan_requests to service_role;

create function public.pattern_scan_request_status(p_user_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'serverTime', now(),
    'nextAllowedAt', r.next_allowed_at,
    'job', case when j.id is null then null else jsonb_build_object(
      'id', j.id, 'pattern', j.pattern, 'market', j.market, 'status', j.status,
      'createdAt', j.created_at, 'finishedAt', j.finished_at, 'summary', j.summary
    ) end
  )
  from (select 1) seed
  left join public.pattern_scan_requests r on r.user_id = p_user_id
  left join public.pattern_scan_jobs j on j.id = r.job_id;
$$;

create function public.request_pattern_scan(p_user_id uuid, p_pattern text, p_market text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user uuid;
  v_job uuid;
  v_reused boolean;
begin
  if p_user_id is null or p_pattern is null or p_market is null
     or p_pattern not in ('ascending_triangle', 'channel', 'cup_and_handle')
     or p_market not in ('US', 'TA') then
    raise exception 'Invalid pattern scan request' using errcode = '22023';
  end if;

  -- This conditional upsert locks a single user row. Concurrent tabs/servers
  -- cannot both reserve a slot, including the user's very first request.
  insert into public.pattern_scan_requests(user_id, next_allowed_at)
  values (p_user_id, now() + interval '2 hours')
  on conflict (user_id) do update set next_allowed_at = excluded.next_allowed_at
    where public.pattern_scan_requests.next_allowed_at <= now()
  returning user_id into v_user;
  if v_user is null then
    return public.pattern_scan_request_status(p_user_id) || jsonb_build_object('accepted', false);
  end if;

  -- Coalesce work across users, and reuse completed scans for two hours.
  perform pg_advisory_xact_lock(7245, hashtext(p_pattern || ':' || p_market));
  select id into v_job from public.pattern_scan_jobs
    where pattern = p_pattern and market = p_market
      and (status in ('queued', 'running')
        or (status = 'completed' and finished_at > now() - interval '2 hours'))
    order by created_at desc limit 1;
  v_reused := v_job is not null;
  if v_job is null then
    insert into public.pattern_scan_jobs(pattern, market) values (p_pattern, p_market)
      returning id into v_job;
  end if;
  update public.pattern_scan_requests set job_id = v_job where user_id = p_user_id;
  return public.pattern_scan_request_status(p_user_id)
    || jsonb_build_object('accepted', true, 'reused', v_reused);
end;
$$;

create function public.claim_pattern_scan()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job public.pattern_scan_jobs;
begin
  update public.pattern_scan_jobs set status = 'failed', finished_at = now(), lease_id = null
    where status = 'running' and lease_expires_at < now() and attempts >= 3;
  select * into v_job from public.pattern_scan_jobs
    where status = 'queued' or (status = 'running' and lease_expires_at < now() and attempts < 3)
    order by created_at for update skip locked limit 1;
  if not found then return null; end if;
  update public.pattern_scan_jobs set status = 'running', attempts = attempts + 1,
    lease_id = gen_random_uuid(), lease_expires_at = now() + interval '20 minutes'
    where id = v_job.id returning * into v_job;
  return jsonb_build_object('id', v_job.id, 'pattern', v_job.pattern,
    'market', v_job.market, 'leaseId', v_job.lease_id);
end;
$$;

create function public.finish_pattern_scan(p_job_id uuid, p_lease_id uuid, p_result jsonb)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare v_summary jsonb;
begin
  if p_result is not null then
    v_summary := p_result || jsonb_build_object('rows', (
      select coalesce(jsonb_agg(r - 'candles'), '[]'::jsonb)
      from jsonb_array_elements(p_result->'rows') r
    ));
  end if;
  update public.pattern_scan_jobs set
    status = case when p_result is null then 'failed' else 'completed' end,
    finished_at = now(), lease_id = null, lease_expires_at = null,
    result = p_result, summary = v_summary
    where id = p_job_id and status = 'running' and lease_id = p_lease_id
      and lease_expires_at >= now();
  return found;
end;
$$;

create function public.pattern_scan_detail(p_user_id uuid, p_job_id uuid, p_ticker text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select row from public.pattern_scan_requests r
  join public.pattern_scan_jobs j on j.id = r.job_id,
  lateral jsonb_array_elements(j.result->'rows') row
  where r.user_id = p_user_id and j.id = p_job_id and j.status = 'completed'
    and row->>'ticker' = p_ticker limit 1;
$$;

-- Twenty indexed symbol lookups per call; each returns only the latest 160
-- daily bars. JSON aggregation avoids the REST row cap truncating a history.
create function public.pattern_scan_series(p_market text, p_after text default '', p_batch_size integer default 20)
returns table(ticker text, company_name text, candles jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.ticker, m.company_name, coalesce(h.candles, '[]'::jsonb)
  from (
    select sm.ticker, sm.company_name from public.symbol_metadata sm
    where sm.market = p_market and sm.ticker > p_after
    order by sm.ticker limit greatest(1, least(p_batch_size, 20))
  ) m
  left join lateral (
    select jsonb_agg(jsonb_build_object('date', b.trade_date, 'open', b.open,
      'high', b.high, 'low', b.low, 'close', b.close) order by b.trade_date) candles
    from (
      select d.trade_date, d.open, d.high, d.low, d.close from public.market_raw_data d
      where d.ticker = m.ticker order by d.trade_date desc limit 160
    ) b
  ) h on true order by m.ticker;
$$;

revoke all on function public.pattern_scan_request_status(uuid),
  public.request_pattern_scan(uuid,text,text), public.claim_pattern_scan(),
  public.finish_pattern_scan(uuid,uuid,jsonb), public.pattern_scan_detail(uuid,uuid,text),
  public.pattern_scan_series(text,text,integer) from public, anon, authenticated;
grant execute on function public.pattern_scan_request_status(uuid),
  public.request_pattern_scan(uuid,text,text), public.claim_pattern_scan(),
  public.finish_pattern_scan(uuid,uuid,jsonb), public.pattern_scan_detail(uuid,uuid,text),
  public.pattern_scan_series(text,text,integer) to service_role;
