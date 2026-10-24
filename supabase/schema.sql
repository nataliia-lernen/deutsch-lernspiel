-- Виконайте один раз у Supabase SQL Editor.
create table if not exists public.learning_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  primary key (user_id, id)
);
alter table public.learning_records enable row level security;
create policy "Read own records" on public.learning_records for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own records" on public.learning_records for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own records" on public.learning_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Застарілий запис з іншого пристрою не замінює новіший.
create or replace function public.keep_newest_learning_record() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce((old.payload->'value'->>'updated')::numeric,0) > coalesce((new.payload->'value'->>'updated')::numeric,0) then
    return old;
  end if;
  return new;
end;
$$;
create trigger keep_newest before update on public.learning_records for each row execute function public.keep_newest_learning_record();
