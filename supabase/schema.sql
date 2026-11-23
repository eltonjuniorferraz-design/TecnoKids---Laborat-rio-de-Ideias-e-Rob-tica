-- TecnoKids classroom backend (Supabase / PostgreSQL)
-- Student sessions use Supabase anonymous auth; students do not need email accounts.

create extension if not exists pgcrypto;

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  join_code text not null unique check (join_code ~ '^[A-Z0-9]{7}$'),
  title text not null check (char_length(title) between 1 and 48),
  instructions text not null default '' check (char_length(instructions) <= 180),
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_participants (
  id uuid primary key references auth.users(id) on delete cascade,
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 24),
  current_stage smallint not null default 1 check (current_stage between 1 and 3),
  logic_complete boolean not null default false,
  maker_complete boolean not null default false,
  presentation_complete boolean not null default false,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.classroom_projects (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  participant_id uuid not null references public.classroom_participants(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  description text not null default '' check (char_length(description) <= 240),
  maker_choices jsonb not null default '{}'::jsonb,
  is_presented boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id)
);

create index if not exists classroom_participants_room_idx on public.classroom_participants(classroom_id);
create index if not exists classroom_projects_room_idx on public.classroom_projects(classroom_id, created_at desc);

alter table public.classrooms enable row level security;
alter table public.classroom_participants enable row level security;
alter table public.classroom_projects enable row level security;

revoke all on public.classrooms, public.classroom_participants, public.classroom_projects from anon, authenticated;
grant select, insert, update, delete on public.classrooms to authenticated;
grant select, insert, update, delete on public.classroom_participants to authenticated;
grant select, insert, update, delete on public.classroom_projects to authenticated;

-- Teachers can manage only their own rooms.
create policy "teachers manage own classrooms"
  on public.classrooms for all to authenticated
  using (
    teacher_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  )
  with check (
    teacher_id = (select auth.uid())
    and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
  );

-- A teacher can see/manage the roster in their rooms; each student sees only their own row.
create policy "teacher and participant read roster"
  on public.classroom_participants for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.classrooms c
      where c.id = classroom_id and c.teacher_id = (select auth.uid())
    )
  );

create policy "teacher manages participants in own rooms"
  on public.classroom_participants for all to authenticated
  using (
    exists (
      select 1 from public.classrooms c
      where c.id = classroom_id and c.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.classrooms c
      where c.id = classroom_id and c.teacher_id = (select auth.uid())
    )
  );

-- Only the author and the room's teacher may read a project.
create policy "teacher and author read projects"
  on public.classroom_projects for select to authenticated
  using (
    participant_id = (select auth.uid())
    or exists (
      select 1 from public.classrooms c
      where c.id = classroom_id and c.teacher_id = (select auth.uid())
    )
  );

create policy "class participants read room mural"
  on public.classroom_projects for select to authenticated
  using (
    exists (
      select 1 from public.classroom_participants p
      where p.id = (select auth.uid()) and p.classroom_id = classroom_projects.classroom_id
    )
  );

create policy "author creates own project in joined room"
  on public.classroom_projects for insert to authenticated
  with check (
    participant_id = (select auth.uid())
    and exists (
      select 1 from public.classroom_participants p
      where p.id = (select auth.uid()) and p.classroom_id = classroom_projects.classroom_id
    )
  );

create policy "author updates own project"
  on public.classroom_projects for update to authenticated
  using (participant_id = (select auth.uid()))
  with check (
    participant_id = (select auth.uid())
    and exists (
      select 1 from public.classroom_participants p
      where p.id = (select auth.uid()) and p.classroom_id = classroom_projects.classroom_id
    )
  );

create policy "teacher manages projects in own rooms"
  on public.classroom_projects for all to authenticated
  using (
    exists (
      select 1 from public.classrooms c
      where c.id = classroom_id and c.teacher_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.classrooms c
      where c.id = classroom_id and c.teacher_id = (select auth.uid())
    )
  );

-- Joining is by room code + first name, with an anonymous auth session for device identity.
create or replace function public.join_classroom(p_code text, p_first_name text)
returns table (room_id uuid, room_title text, room_instructions text, participant_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_class public.classrooms%rowtype;
  v_name text := left(trim(regexp_replace(coalesce(p_first_name, ''), '[^[:alpha:] ''-]', '', 'g')), 24);
begin
  if v_uid is null then raise exception 'É necessário iniciar uma sessão de aluno.'; end if;
  if v_name = '' then raise exception 'Informe apenas o primeiro nome.'; end if;

  select * into v_class from public.classrooms
  where join_code = upper(trim(p_code)) and is_open;
  if not found then raise exception 'Sala não encontrada ou encerrada.'; end if;

  insert into public.classroom_participants (id, classroom_id, first_name)
  values (v_uid, v_class.id, v_name)
  on conflict (id) do update
    set classroom_id = excluded.classroom_id,
        first_name = excluded.first_name,
        last_seen_at = now();

  return query select v_class.id, v_class.title, v_class.instructions, v_uid;
end;
$$;

-- Legacy sequential completion RPC retained for compatibility.
create or replace function public.complete_classroom_stage(p_stage smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare v_participant public.classroom_participants%rowtype;
begin
  select * into v_participant from public.classroom_participants
  where id = auth.uid() for update;
  if not found then raise exception 'Entre na sala antes de registrar o progresso.'; end if;
  if p_stage <> v_participant.current_stage then raise exception 'Conclua a etapa atual antes de avançar.'; end if;

  update public.classroom_participants
  set logic_complete = logic_complete or p_stage = 1,
      maker_complete = maker_complete or p_stage = 2,
      presentation_complete = presentation_complete or p_stage = 3,
      current_stage = least(3, current_stage + 1),
      last_seen_at = now()
  where id = auth.uid()
  returning current_stage into v_participant.current_stage;
  return v_participant.current_stage;
end;
$$;

-- Students may visit stations in any order; record the current station and completion.
create or replace function public.track_classroom_activity(p_stage smallint, p_completed boolean default false)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare v_stage smallint;
begin
  if p_stage not between 1 and 3 then raise exception 'Atividade inválida.'; end if;

  update public.classroom_participants
  set current_stage = p_stage,
      logic_complete = logic_complete or (p_stage = 1 and coalesce(p_completed, false)),
      maker_complete = maker_complete or (p_stage = 2 and coalesce(p_completed, false)),
      presentation_complete = presentation_complete or (p_stage = 3 and coalesce(p_completed, false)),
      last_seen_at = now()
  where id = auth.uid()
  returning current_stage into v_stage;

  if not found then raise exception 'Entre na sala antes de registrar a atividade.'; end if;
  return v_stage;
end;
$$;

revoke all on function public.join_classroom(text, text) from public, anon;
revoke all on function public.complete_classroom_stage(smallint) from public, anon;
revoke all on function public.track_classroom_activity(smallint, boolean) from public, anon;
grant execute on function public.join_classroom(text, text) to authenticated;
grant execute on function public.complete_classroom_stage(smallint) to authenticated;
grant execute on function public.track_classroom_activity(smallint, boolean) to authenticated;

