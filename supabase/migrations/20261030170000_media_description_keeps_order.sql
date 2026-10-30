-- Describing an image (AI caption, alt text, and tags in metadata.ai_tags) shouldn't move it to the top of "newest".
create or replace function public.set_media_updated_at()
returns trigger
language plpgsql
as $$
begin
  if new.metadata->'ai_tags' is distinct from old.metadata->'ai_tags' then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists set_media_updated_at on public.media;
create trigger set_media_updated_at
before update on public.media
for each row execute function public.set_media_updated_at();
