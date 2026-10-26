-- Administrador master (só o Ricardo): vê a página "Acessos" — quem já entrou no sistema, quem ainda não,
-- quando usou pela última vez e quantas quadras marcou.

alter table public.perfis add column if not exists master boolean not null default false;
alter table public.perfis add column if not exists ultimo_acesso timestamptz;

-- Ninguém se torna master pelo site: só pelo banco (service role) ou por outro master.
create or replace function public.proteger_master() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.master is distinct from old.master and auth.uid() is not null
     and not exists (select 1 from perfis where id = auth.uid() and master) then
    raise exception 'Só o administrador master pode mudar isso.';
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_master on public.perfis;
create trigger proteger_master before update on public.perfis
  for each row execute function public.proteger_master();

create or replace function public.eh_master() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from perfis where id = auth.uid() and master and ativo);
$$;

-- Cada vez que alguém abre o site já logado, registra o "último uso" (no máximo a cada 10 minutos).
create or replace function public.registrar_acesso() returns void
language sql security definer set search_path = public as $$
  update perfis set ultimo_acesso = now()
   where id = auth.uid() and (ultimo_acesso is null or ultimo_acesso < now() - interval '10 minutes');
$$;

create or replace function public.painel_acessos()
returns table (
  id uuid, nome text, telefone text, papel text, ativo boolean, entrou boolean,
  cadastrado_em timestamptz, ultimo_login timestamptz, ultimo_uso timestamptz,
  quadras_marcadas integer, ultima_marcacao date, proxima_saida date
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.eh_master() then
    raise exception 'Só o administrador master vê esta página.';
  end if;
  return query
  select p.id, p.nome, p.telefone, p.papel, p.ativo,
         not p.precisa_trocar_senha,
         p.criado_em,
         u.last_sign_in_at,
         greatest(p.ultimo_acesso, u.last_sign_in_at),
         (select count(*)::int from marcacoes m where m.dirigente_id = p.id),
         (select max(m.data) from marcacoes m where m.dirigente_id = p.id),
         (select min(s.data) from saidas s where s.dirigente_id = p.id and s.data >= hoje_local() and s.chave not like 'teste:%')
    from perfis p
    join auth.users u on u.id = p.id
   order by p.nome;
end;
$$;

revoke all on function public.eh_master() from public, anon;
revoke all on function public.registrar_acesso() from public, anon;
revoke all on function public.painel_acessos() from public, anon;
grant execute on function public.eh_master() to authenticated;
grant execute on function public.registrar_acesso() to authenticated;
grant execute on function public.painel_acessos() to authenticated;

update public.perfis set master = true where telefone = '5511900000000';
