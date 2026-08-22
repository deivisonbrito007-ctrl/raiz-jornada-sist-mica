create table public.diario_eixos (
  id uuid primary key default gen_random_uuid(),
  diario_id uuid not null references public.diario(id) on delete cascade,
  eixo_id uuid not null references public.eixos(id) on delete cascade,
  cliente_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (diario_id, eixo_id)
);

grant select, insert, update, delete on public.diario_eixos to authenticated;
grant all on public.diario_eixos to service_role;

alter table public.diario_eixos enable row level security;

create policy "cliente cuida das tags do proprio diario"
on public.diario_eixos for all to authenticated
using (cliente_id = auth.uid())
with check (cliente_id = auth.uid());

create policy "acompanhamento le tags de reflexoes compartilhadas"
on public.diario_eixos for select to authenticated
using (
  exists (
    select 1 from public.diario d
    where d.id = diario_eixos.diario_id
      and d.visibilidade = 'compartilhado'
      and public.no_escopo(d.cliente_id)
  )
);

create index diario_eixos_diario_idx on public.diario_eixos (diario_id);
create index diario_eixos_cliente_idx on public.diario_eixos (cliente_id, eixo_id);

alter table public.preferencias_lembretes
  add column if not exists silenciado_ate timestamptz;

alter table public.profiles
  add column if not exists onboarding_dispensado_em timestamptz,
  add column if not exists onboarding_concluido_em timestamptz;