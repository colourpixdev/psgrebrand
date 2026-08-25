create table if not exists public.user_followed_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists user_followed_items_user_id_idx on public.user_followed_items (user_id);

alter table public.user_followed_items enable row level security;

grant select, insert, delete on table public.user_followed_items to authenticated;

drop policy if exists "Users can read their followed items" on public.user_followed_items;
create policy "Users can read their followed items"
  on public.user_followed_items
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can add their followed items" on public.user_followed_items;
create policy "Users can add their followed items"
  on public.user_followed_items
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove their followed items" on public.user_followed_items;
create policy "Users can remove their followed items"
  on public.user_followed_items
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);