create table if not exists public.order_links(
  token text primary key,
  etsy_order_no text not null unique,
  poster_type text not null check (poster_type in ('single','couple')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  used_at timestamptz,
  order_id uuid
);
alter table public.order_links enable row level security;

create or replace function public.admin_create_order_link(p_etsy_no text, p_type text)
returns text language plpgsql security definer set search_path to '' as $f$
declare v_no text := btrim(coalesce(p_etsy_no,'')); v_tok text; r public.order_links;
begin
  if auth.uid() is distinct from '207a6d67-2813-46ed-a9fd-b23596fe5a35'::uuid then raise exception 'Yetkisiz.'; end if;
  if v_no = '' or length(v_no) > 40 then raise exception 'Etsy sipariş numarası geçersiz.'; end if;
  if p_type not in ('single','couple') then raise exception 'Tür geçersiz.'; end if;
  select * into r from public.order_links where etsy_order_no = v_no;
  if found then
    if r.used_at is not null then raise exception 'Bu Etsy siparişinin linki zaten kullanıldı.'; end if;
    if r.poster_type <> p_type then raise exception 'Bu sipariş için başka türde link var.'; end if;
    update public.order_links set expires_at = now() + interval '30 days' where token = r.token;
    return r.token;
  end if;
  v_tok := substr(replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), 1, 40);
  insert into public.order_links(token, etsy_order_no, poster_type) values (v_tok, v_no, p_type);
  return v_tok;
end $f$;

create or replace function public.admin_list_order_links()
returns table(token text, etsy_order_no text, poster_type text, created_at timestamptz, used_at timestamptz, state text)
language plpgsql security definer set search_path to '' as $f$
begin
  if auth.uid() is distinct from '207a6d67-2813-46ed-a9fd-b23596fe5a35'::uuid then raise exception 'Yetkisiz.'; end if;
  return query select l.token, l.etsy_order_no, l.poster_type, l.created_at, l.used_at,
    case when l.used_at is not null and l.used_at + interval '10 minutes' > now() then 'sipariş alındı (10 dk içinde)'
         when l.used_at is not null then 'kullanıldı · öldü'
         when l.expires_at < now() then 'süresi doldu'
         else 'bekliyor' end
  from public.order_links l order by l.created_at desc limit 60;
end $f$;

create or replace function public.check_order_link(p_token text)
returns jsonb language plpgsql security definer set search_path to '' as $f$
declare r public.order_links;
begin
  select * into r from public.order_links where token = coalesce(p_token,'');
  if not found then return jsonb_build_object('state','invalid'); end if;
  if r.used_at is not null then
    if r.used_at + interval '10 minutes' > now() then return jsonb_build_object('state','done'); end if;
    return jsonb_build_object('state','expired');
  end if;
  if r.expires_at < now() then return jsonb_build_object('state','expired'); end if;
  return jsonb_build_object('state','ok','poster_type',r.poster_type,'etsy_order_no',r.etsy_order_no);
end $f$;

drop function if exists public.create_order(text,text,text,text,text,text,text,text,text,text,text,double precision,double precision,text,double precision,double precision,text,text,text,text);

create or replace function public.create_order(
  p_token text,
  p_woman_name text, p_woman_date text, p_woman_time text, p_woman_place text,
  p_man_name text, p_man_date text, p_man_time text, p_man_place text,
  p_lang text default 'tr', p_note text default null,
  p_woman_lat double precision default null, p_woman_lon double precision default null, p_woman_tz text default null,
  p_man_lat double precision default null, p_man_lon double precision default null, p_man_tz text default null,
  p_woman_detail text default null, p_man_detail text default null, p_email text default null)
returns uuid language plpgsql security definer set search_path to '' as $f$
declare new_id uuid; v_rev jsonb; v_single boolean; l public.order_links;
begin
  select * into l from public.order_links where token = coalesce(p_token,'') for update;
  if not found then raise exception 'Geçersiz bağlantı.'; end if;
  if l.used_at is not null then raise exception 'Bu bağlantı daha önce kullanıldı.'; end if;
  if l.expires_at < now() then raise exception 'Bağlantının süresi doldu.'; end if;

  if coalesce(btrim(p_woman_name),'')='' or coalesce(btrim(p_woman_date),'')=''
     or coalesce(btrim(p_woman_time),'')='' or coalesce(btrim(p_woman_place),'')='' then
    raise exception 'Eksik bilgi: kişi bilgileri zorunludur.';
  end if;
  v_single := coalesce(btrim(p_man_name),'')='';
  if v_single <> (l.poster_type = 'single') then raise exception 'Bu bağlantı % poster içindir.', l.poster_type; end if;
  if not v_single then
    if coalesce(btrim(p_man_date),'')='' or coalesce(btrim(p_man_time),'')='' or coalesce(btrim(p_man_place),'')='' then
      raise exception 'Eksik bilgi: 2. kişi bilgileri zorunludur.';
    end if;
  end if;
  if length(p_woman_name)>120 or length(coalesce(p_man_name,''))>120
     or length(p_woman_place)>160 or length(coalesce(p_man_place,''))>160
     or length(coalesce(p_woman_detail,''))>120 or length(coalesce(p_man_detail,''))>120
     or length(coalesce(p_note,''))>1000 or length(coalesce(p_email,''))>200 then
    raise exception 'Girdi çok uzun.';
  end if;
  if p_email is not null and btrim(p_email)<>'' and position('@' in p_email)=0 then
    raise exception 'Geçersiz e-posta.';
  end if;

  v_rev := jsonb_build_object(
    'woman', case when p_woman_lat is not null then jsonb_build_object('confidence','SELECTED','tz',p_woman_tz) else null end,
    'man',   case when p_man_lat   is not null then jsonb_build_object('confidence','SELECTED','tz',p_man_tz)   else null end);

  insert into public.orders(
    woman_name, woman_date, woman_time, woman_place, woman_place_detail, woman_lat, woman_lon, woman_tz,
    man_name,   man_date,   man_time,   man_place,   man_place_detail,   man_lat,   man_lon,   man_tz,
    lang, order_no, customer_note, location_review, status, poster_type, email)
  values(
    btrim(p_woman_name), btrim(p_woman_date), btrim(p_woman_time), btrim(p_woman_place), nullif(btrim(p_woman_detail),''), p_woman_lat, p_woman_lon, p_woman_tz,
    nullif(btrim(p_man_name),''), nullif(btrim(p_man_date),''), nullif(btrim(p_man_time),''), nullif(btrim(p_man_place),''), nullif(btrim(p_man_detail),''), p_man_lat, p_man_lon, p_man_tz,
    coalesce(nullif(btrim(p_lang),''),'tr'), 'ETSY-' || l.etsy_order_no, nullif(btrim(p_note),''), v_rev,
    'NEW', l.poster_type, lower(nullif(btrim(p_email),'')))
  returning id into new_id;

  update public.order_links set used_at = now(), order_id = new_id where token = l.token;
  return new_id;
end $f$;

revoke all on function public.admin_create_order_link(text,text) from public, anon;
revoke all on function public.admin_list_order_links() from public, anon;
grant execute on function public.admin_create_order_link(text,text) to authenticated;
grant execute on function public.admin_list_order_links() to authenticated;
revoke all on function public.check_order_link(text) from public;
grant execute on function public.check_order_link(text) to anon, authenticated;
revoke all on function public.create_order(text,text,text,text,text,text,text,text,text,text,text,double precision,double precision,text,double precision,double precision,text,text,text,text) from public;
grant execute on function public.create_order(text,text,text,text,text,text,text,text,text,text,text,double precision,double precision,text,double precision,double precision,text,text,text,text) to anon, authenticated;
