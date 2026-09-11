-- KejaSearch Supabase schema
-- Run this once in the Supabase SQL Editor.
-- Passwords are managed and hashed by Supabase Auth; never store them here.
create extension if not exists pgcrypto;
-- If the admin account already exists but is unconfirmed, run this one time
-- in the Supabase SQL Editor, then remove the comment markers:
-- update auth.users
-- set email_confirmed_at = coalesce(email_confirmed_at, now())
-- where lower(email) = 'barakelly0209@gmail.com';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null,
  phone text not null,
  role text not null check (role in ('tenant', 'landlord')),
  marketing_consent boolean not null default false,
  phone_verified boolean not null default false,
  email_confirmed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email_confirmed boolean not null default false;

alter table public.profiles enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'barakakelly0209@gmail.com';
$$;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

drop policy if exists "Admins can delete profiles" on public.profiles;
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

drop policy if exists "Public can read landlord display profiles" on public.profiles;
create policy "Public can read landlord display profiles"
  on public.profiles for select
  using (true);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, phone, role, marketing_consent, email_confirmed)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    coalesce(new.raw_user_meta_data ->> 'role', 'tenant'),
    coalesce((new.raw_user_meta_data ->> 'marketing_consent')::boolean, false),
    new.email_confirmed_at is not null
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.sync_email_confirmation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set email_confirmed = new.email_confirmed_at is not null
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmation_changed on auth.users;
create trigger on_auth_user_confirmation_changed
  after update of email_confirmed_at on auth.users
  for each row execute procedure public.sync_email_confirmation();

update public.profiles as profiles
set email_confirmed = auth_users.email_confirmed_at is not null
from auth.users as auth_users
where profiles.id = auth_users.id;

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('property-videos', 'property-videos', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload property images" on storage.objects;
create policy "Authenticated users can upload property images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone can view property images" on storage.objects;
create policy "Anyone can view property images"
  on storage.objects for select to public
  using (bucket_id = 'property-images');

drop policy if exists "Users can delete their property images" on storage.objects;
create policy "Users can delete their property images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and owner_id = auth.uid()::text
  );

drop policy if exists "Authenticated users can upload property videos" on storage.objects;
create policy "Authenticated users can upload property videos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Anyone can view property videos" on storage.objects;
create policy "Anyone can view property videos"
  on storage.objects for select to public
  using (bucket_id = 'property-videos');

drop policy if exists "Users can delete their property videos" on storage.objects;
create policy "Users can delete their property videos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-videos'
    and owner_id = auth.uid()::text
  );

-- Application data
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('House', 'Office')),
  price integer not null check (price >= 0),
  rooms integer not null check (rooms >= 0),
  bathrooms integer not null check (bathrooms >= 0),
  phone text not null,
  kitchen text not null,
  power text not null,
  water text not null,
  parking text not null,
  description text not null,
  image_url text,
  video_url text,
  status text not null default 'Pending verification' check (status in ('Pending verification', 'Verified', 'Rejected')),
  suspended boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  review_text text not null check (char_length(review_text) >= 15),
  confirmed_tenancy boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  tenant_id uuid references public.profiles(id) on delete set null,
  tenant_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'Pending' check (status in ('Pending', 'Approved', 'Rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.properties enable row level security;
alter table public.reviews enable row level security;
alter table public.enquiries enable row level security;
alter table public.deletion_requests enable row level security;

drop policy if exists "Public can view verified properties" on public.properties;
create policy "Public can view verified properties"
  on public.properties for select to anon, authenticated
  using (status = 'Verified' and suspended = false);

drop policy if exists "Landlords can view their properties" on public.properties;
create policy "Landlords can view their properties"
  on public.properties for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "Landlords can create their properties" on public.properties;
create policy "Landlords can create their properties"
  on public.properties for insert to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "Landlords and admins can update properties" on public.properties;
create policy "Landlords and admins can update properties"
  on public.properties for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists "Landlords and admins can delete properties" on public.properties;
create policy "Landlords and admins can delete properties"
  on public.properties for delete to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists "Anyone can read reviews" on public.reviews;
create policy "Anyone can read reviews"
  on public.reviews for select to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can create reviews" on public.reviews;
create policy "Authenticated users can create reviews"
  on public.reviews for insert to authenticated
  with check (reviewer_id = auth.uid() and confirmed_tenancy = true);

drop policy if exists "Admins can moderate reviews" on public.reviews;
create policy "Admins can moderate reviews"
  on public.reviews for delete to authenticated
  using (public.is_admin());

drop policy if exists "Tenants can create enquiries" on public.enquiries;
create policy "Tenants can create enquiries"
  on public.enquiries for insert to authenticated
  with check (tenant_id = auth.uid());

drop policy if exists "Users can view related enquiries" on public.enquiries;
create policy "Users can view related enquiries"
  on public.enquiries for select to authenticated
  using (tenant_id = auth.uid() or exists (
    select 1 from public.properties
    where public.properties.id = enquiries.property_id
      and public.properties.owner_id = auth.uid()
  ) or public.is_admin());

drop policy if exists "Users can request account deletion" on public.deletion_requests;
create policy "Users can request account deletion"
  on public.deletion_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users and admins can view deletion requests" on public.deletion_requests;
create policy "Users and admins can view deletion requests"
  on public.deletion_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can review deletion requests" on public.deletion_requests;
create policy "Admins can review deletion requests"
  on public.deletion_requests for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
