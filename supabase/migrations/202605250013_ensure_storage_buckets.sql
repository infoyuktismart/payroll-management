-- Migration 202605250013: Ensure Storage Buckets Exist
begin;

-- 1. Insert 'employee-documents' and 'employee-profiles' into storage.buckets if they do not exist
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'employee-documents', 
    'employee-documents', 
    true, 
    5242880, -- 5MB limit
    array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
on conflict (id) do update set 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'employee-profiles', 
    'employee-profiles', 
    true, 
    2097152, -- 2MB limit for profiles
    array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set 
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

commit;
