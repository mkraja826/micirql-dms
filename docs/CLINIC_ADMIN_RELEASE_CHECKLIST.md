# CapDent Clinic Admin — Production Release Checklist

PR: `#9`  
Branch: `feature/clinic-admin-dashboard-v1`  
Protected real clinic: **Never test or modify BG Reddy Dental Clinic.**  
Safe functional clinic: **ospuuq**.

## Automated release gates

- [ ] GitHub Actions production build passes.
- [ ] Portal output contains the monitoring and accessibility assets.
- [ ] Bundle budget passes with at least six cacheable JavaScript chunks and no chunk above 300 KB.
- [ ] Invalid credentials cannot enter Clinic Admin.
- [ ] Mock-authenticated owner navigation covers every sidebar module.
- [ ] No serious or critical automated accessibility violations.
- [ ] Supabase project status is `ACTIVE_HEALTHY`.
- [ ] Owner and head doctor pass the read-only permission matrix.
- [ ] Working doctor and receptionist are denied admin reads and writes with SQLSTATE `42501`.
- [ ] Invoice paid totals and due totals have zero mismatches.
- [ ] Supabase security and performance advisors are reviewed after the final migration.

## Mandatory backup gate for the current Free plan

The Supabase organization is currently on the **Free plan**. Supabase does not provide scheduled downloadable daily backups for Free plan projects. Do not merge the admin dashboard until a logical backup has been created and stored outside the development machine.

1. Copy the **Session Pooler** connection string from Supabase Dashboard → Connect.
2. Set it only for the current PowerShell session:

```powershell
$env:CAPDENT_DATABASE_URL = "postgresql://postgres.PROJECT_REF:PASSWORD@SESSION_POOLER:5432/postgres"
```

3. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup-capdent-production.ps1
```

4. Verify the backup:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-capdent-backup.ps1 -BackupDirectory "$HOME\CapDentBackups\BACKUP_TIMESTAMP"
```

5. Copy the verified backup folder to encrypted off-site storage.
6. Record the backup timestamp and SHA256 manifest in the PR without posting the database URL, password, SQL files, or patient information.
7. Back up clinical storage objects separately when the clinic uses Supabase Storage or another object store. Database dumps include file metadata, not deleted or external binary objects.
8. Clear the connection string after completion:

```powershell
Remove-Item Env:CAPDENT_DATABASE_URL
```

- [ ] Roles dump exists and is non-empty.
- [ ] Schema dump exists and contains table definitions.
- [ ] Data dump exists and contains COPY or INSERT statements.
- [ ] SHA256 manifest verification passes.
- [ ] Backup is stored in encrypted off-site storage.
- [ ] Clinical binary files have a separate verified backup.

## Authentication hardening

- [ ] Enable Supabase Auth leaked-password protection before general availability.
- [ ] Confirm the production password policy and minimum password length.
- [ ] Confirm allowed redirect URLs contain only CapDent production domains.
- [ ] Confirm no service-role or database credentials are present in browser bundles, Git history, screenshots, or PR comments.
- [ ] Confirm the browser uses only the Supabase publishable key.

## Safe authenticated functional test — ospuuq only

- [ ] Sign in as the ospuuq owner or head doctor.
- [ ] Verify the selected clinic name is ospuuq before changing anything.
- [ ] Edit and restore one harmless demo patient field with a reason.
- [ ] Create, reschedule and complete one demo appointment.
- [ ] Correct one harmless clinical note and confirm its audit entry.
- [ ] Perform a small test financial correction, refund and reversal; confirm invoice versions remain balanced.
- [ ] Invite, cancel, deactivate and reactivate one demo staff identity.
- [ ] Change and restore one harmless clinic setting.
- [ ] Export one CSV and confirm an export audit record is written.
- [ ] Archive and restore one demo patient.
- [ ] Confirm Android v24 still displays the resulting compatible records.
- [ ] Confirm no test record remains active or financially outstanding after cleanup.

## Monitoring and recovery

- [ ] Trigger one harmless authenticated test exception and confirm a sanitized row appears in `admin_client_error_logs`.
- [ ] Confirm the logged message contains no password, access token, email address or patient form content.
- [ ] Run `admin_get_release_health()` as an owner/head doctor and confirm zero financial mismatches.
- [ ] Confirm a receptionist and working doctor cannot call `admin_get_release_health()`.
- [ ] Review Postgres, Auth and API logs for new errors after the final deployment.
- [ ] Confirm Cloudflare deploys the exact final commit tested by GitHub Actions.

## Merge decision

The PR may be marked ready and merged only when:

- every automated gate passes,
- the verified off-site backup exists,
- authenticated ospuuq testing is complete,
- leaked-password protection is enabled or explicitly accepted as a documented risk,
- no serious security advisor finding remains unexplained,
- no financial integrity mismatch exists,
- the deployed Cloudflare commit equals the approved PR head.
