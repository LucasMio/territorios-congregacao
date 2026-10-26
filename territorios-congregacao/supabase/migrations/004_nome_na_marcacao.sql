-- Guarda o nome de quem marcou junto com a marcação, para todos os dirigentes verem
-- "feita por Fulano" sem precisar acessar o cadastro dos outros irmãos.

alter table public.marcacoes add column if not exists dirigente_nome text;

create or replace function public.conferir_marcacao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from quadras where id = new.quadra_id and territorio_numero = new.territorio_numero) then
    raise exception 'A quadra % não pertence ao território %.', new.quadra_id, new.territorio_numero;
  end if;
  new.dirigente_nome := (select nome from perfis where id = new.dirigente_id);
  return new;
end;
$$;
