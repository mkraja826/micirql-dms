-- Read-only Clinic Admin role permission matrix.
-- Run in Supabase SQL Editor. The transaction is always rolled back.
-- Never change the BG Reddy Dental Clinic exclusion.

begin;

create temporary table permission_matrix_results (
  role_name text,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

do $$
declare
  v_owner uuid;
  v_head uuid;
  v_doctor uuid;
  v_receptionist uuid;
  v_id uuid;
  v_role text;
  v_state text;
  v_message text;
begin
  select p.id into v_owner
  from public.profiles p
  join public.clinics c on c.id = p.clinic_id
  where p.active = true and p.role = 'owner'
    and lower(c.name) <> lower('BG Reddy Dental Clinic')
  order by p.created_at
  limit 1;

  select p.id into v_head
  from public.profiles p
  join public.clinics c on c.id = p.clinic_id
  where p.active = true and p.role = 'head_doctor' and lower(c.name) = lower('ospuuq')
  limit 1;

  select p.id into v_doctor
  from public.profiles p
  join public.clinics c on c.id = p.clinic_id
  where p.active = true and p.role in ('doctor', 'working_doctor')
    and lower(c.name) <> lower('BG Reddy Dental Clinic')
  order by case when lower(c.name) = lower('Micirql demo clinic') then 0 else 1 end, p.created_at
  limit 1;

  select p.id into v_receptionist
  from public.profiles p
  join public.clinics c on c.id = p.clinic_id
  where p.active = true and p.role = 'receptionist' and lower(c.name) = lower('ospuuq')
  limit 1;

  if v_owner is null or v_head is null or v_doctor is null or v_receptionist is null then
    raise exception 'Required safe role fixtures were not found.';
  end if;

  foreach v_id in array array[v_owner, v_head] loop
    v_role := case when v_id = v_owner then 'owner' else 'head_doctor' end;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    begin
      perform public.admin_get_release_health();
      insert into permission_matrix_results values (v_role, 'release_health_read', true, 'allowed');
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into permission_matrix_results values (v_role, 'release_health_read', false, v_state || ': ' || v_message);
    end;

    begin
      perform public.admin_get_unified_audit(now() - interval '1 day', now(), 'all', null, 1, 0);
      insert into permission_matrix_results values (v_role, 'unified_audit_read', true, 'allowed');
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into permission_matrix_results values (v_role, 'unified_audit_read', false, v_state || ': ' || v_message);
    end;
  end loop;

  foreach v_id in array array[v_doctor, v_receptionist] loop
    v_role := case when v_id = v_doctor then 'working_doctor' else 'receptionist' end;
    perform set_config('request.jwt.claims', jsonb_build_object('sub', v_id, 'role', 'authenticated')::text, true);

    begin
      perform public.admin_get_release_health();
      insert into permission_matrix_results values (v_role, 'release_health_denied', false, 'unexpectedly allowed');
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into permission_matrix_results values (v_role, 'release_health_denied', v_state = '42501', v_state || ': ' || v_message);
    end;

    begin
      perform public.admin_get_unified_audit(now() - interval '1 day', now(), 'all', null, 1, 0);
      insert into permission_matrix_results values (v_role, 'unified_audit_denied', false, 'unexpectedly allowed');
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into permission_matrix_results values (v_role, 'unified_audit_denied', v_state = '42501', v_state || ': ' || v_message);
    end;

    begin
      perform public.admin_update_patient(
        '00000000-0000-0000-0000-000000000001'::uuid,
        'Permission test', null, null, null, null, null, null, null,
        'Permission matrix test'
      );
      insert into permission_matrix_results values (v_role, 'patient_write_denied', false, 'unexpectedly allowed');
    exception when others then
      get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
      insert into permission_matrix_results values (v_role, 'patient_write_denied', v_state = '42501', v_state || ': ' || v_message);
    end;
  end loop;
end;
$$;

select role_name, check_name, passed, detail
from permission_matrix_results
order by role_name, check_name;

rollback;
