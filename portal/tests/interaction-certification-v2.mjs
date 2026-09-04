import { chromium } from 'playwright';

const baseUrl = process.env.PORTAL_TEST_URL || 'http://127.0.0.1:4173/portal/';
const now = new Date();
const USER_ID='79a71e71-d8c9-4c2e-8e84-e147424126da', CLINIC_ID='dd3a4818-f890-40ac-b4c7-568699bc9755';
const PATIENT_ID='11111111-1111-4111-8111-111111111111', APPOINTMENT_ID='22222222-2222-4222-8222-222222222222';
const VISIT_ID='33333333-3333-4333-8333-333333333333', INVOICE_ID='44444444-4444-4444-8444-444444444444';
const PAYMENT_ID='55555555-5555-4555-8555-555555555555', TREATMENT_ID='66666666-6666-4666-8666-666666666666';
const FILE_ID='77777777-7777-4777-8777-777777777777', STAFF_ID='88888888-8888-4888-8888-888888888888';
const INVITE_ID='99999999-9999-4999-8999-999999999999';
const monthDate = new Date(now.getFullYear(), now.getMonth(), Math.min(now.getDate(), 5), 10, 30).toISOString();
const authUser={id:USER_ID,aud:'authenticated',role:'authenticated',email:'owner-test@ospuuq.invalid',email_confirmed_at:now.toISOString(),app_metadata:{provider:'email',providers:['email']},user_metadata:{},identities:[],created_at:now.toISOString(),updated_at:now.toISOString()};
const profile={id:USER_ID,clinic_id:CLINIC_ID,name:'Test Head Doctor',email:authUser.email,phone:'9000000000',role:'head_doctor',active:true,created_at:monthDate};
const staff={id:STAFF_ID,clinic_id:CLINIC_ID,name:'Working Doctor',email:'doctor@example.invalid',phone:'9000000011',role:'working_doctor',active:true,created_at:monthDate};
const clinic={id:CLINIC_ID,name:'ospuuq',phone:'9000000001',email:'clinic@ospuuq.invalid',address:'Test clinic',country_code:'IN',currency_code:'INR',active:true,brand_color:'#087f72',opening_time:'09:00:00',closing_time:'20:00:00',op_fee_amount:300,enable_patient_photos:true,enable_prescription_medications:true,payment_push_enabled:true,tooth_chart_enabled:true};
const patient={id:PATIENT_ID,clinic_id:CLINIC_ID,patient_code:'TEST-001',name:'Demo Patient',phone:'9000000002',email:'patient@example.invalid',age:31,gender:'Other',dob:'1995-01-01',address:'Demo address',emergency_contact:'9000000003',created_by:USER_ID,created_at:monthDate,updated_at:monthDate,archived_at:null,archive_reason:null};
const appointment={id:APPOINTMENT_ID,clinic_id:CLINIC_ID,patient_id:PATIENT_ID,doctor_id:USER_ID,created_by:USER_ID,appointment_time:monthDate,status:'scheduled',notes:'Mock appointment',created_at:monthDate,updated_at:monthDate,patients:{name:patient.name,phone:patient.phone},profiles:{name:profile.name}};
const visit={id:VISIT_ID,clinic_id:CLINIC_ID,patient_id:PATIENT_ID,doctor_id:USER_ID,created_by:USER_ID,visit_date:monthDate,visit_status:'completed',chief_complaint:'Routine check',diagnosis:'Healthy',doctor_notes:'Mock visit',next_appointment_date:null,created_at:monthDate,updated_at:monthDate,patients:{id:PATIENT_ID,patient_code:patient.patient_code,name:patient.name,phone:patient.phone},profiles:{id:USER_ID,name:profile.name}};
const treatment={id:TREATMENT_ID,clinic_id:CLINIC_ID,patient_id:PATIENT_ID,visit_id:VISIT_ID,treatment_name:'Consultation',description:'Mock treatment',category:'General',status:'completed',cost:500,created_at:monthDate,updated_at:monthDate};
const payment={id:PAYMENT_ID,clinic_id:CLINIC_ID,patient_id:PATIENT_ID,invoice_id:INVOICE_ID,amount:500,payment_method:'UPI',payment_category:'treatment_fee',notes:'Mock payment',created_at:monthDate,updated_at:monthDate,collected_by:USER_ID,status:'active',patients:{id:PATIENT_ID,patient_code:patient.patient_code,name:patient.name,phone:patient.phone},profiles:{name:profile.name}};
const invoice={id:INVOICE_ID,clinic_id:CLINIC_ID,patient_id:PATIENT_ID,visit_id:VISIT_ID,original_total_amount:800,total_amount:800,paid_amount:500,due_amount:300,discount_amount:0,waived_amount:0,refunded_amount:0,version_number:1,status:'partial',invoice_type:'treatment',payment_category:'treatment_fee',notes:'',created_at:monthDate,updated_at:monthDate,patients:{id:PATIENT_ID,patient_code:patient.patient_code,name:patient.name,phone:patient.phone}};
const galleryFile={id:FILE_ID,clinic_id:CLINIC_ID,patient_id:PATIENT_ID,visit_id:VISIT_ID,file_type:'xray',file_url:'https://example.invalid/demo-xray.jpg',file_name:'Demo X-ray',file_note:'Mock file',storage_bucket:null,storage_path:null,mime_type:'image/jpeg',original_size_bytes:2048,stored_size_bytes:1024,uploaded_by:USER_ID,created_at:monthDate,archived_at:null,archived_by:null,archive_reason:null,patients:{id:PATIENT_ID,name:patient.name,phone:patient.phone,patient_code:patient.patient_code},profiles:{id:USER_ID,name:profile.name,role:profile.role},patient_visits:{id:VISIT_ID,visit_date:monthDate,chief_complaint:'Routine check'}};
const invite={id:INVITE_ID,clinic_id:CLINIC_ID,name:'Pending Doctor',email:'pending@example.invalid',role:'working_doctor',invite_code:'TESTCODE',created_at:monthDate};

const rpcCalls=[];
const json=(route,body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body),headers:{'Content-Range':'0-0/1'}});
const bodyOf=(route)=>{try{return JSON.parse(route.request().postData()||'{}')}catch{return {}}};
function table(resource,url){
  if(resource==='profiles') return url.searchParams.has('id')?profile:[profile,staff];
  if(resource==='clinics') return clinic;
  if(resource==='patients') return [patient]; if(resource==='appointments') return [appointment];
  if(resource==='patient_visits') return [visit]; if(resource==='treatments') return [treatment];
  if(resource==='payments') return [payment]; if(resource==='invoices') return [invoice]; if(resource==='files') return [galleryFile];
  if(resource==='dental_chart_entries'||resource.endsWith('_audit_logs')||resource==='financial_adjustments'||resource==='invoice_versions'||resource==='patient_files'||resource==='device_push_tokens'||resource==='staff_invites') return [];
  return [];
}
function rpc(name,body){
  rpcCalls.push({name,body});
  if(name==='admin_update_patient') return {...patient,name:body.p_name??patient.name};
  if(name==='admin_set_patient_archived') return {...patient,archived_at:body.p_archived?now.toISOString():null};
  if(name==='admin_create_appointment'||name==='admin_update_appointment') return appointment;
  if(name==='admin_update_clinical_visit') return visit; if(name==='admin_update_clinical_treatment') return treatment;
  if(name==='admin_add_dental_chart_correction') return {id:'chart-entry',...body};
  if(name==='admin_set_file_archived') return {...galleryFile,archived_at:body.p_archived?now.toISOString():null};
  if(['admin_correct_payment','admin_refund_payment','admin_void_payment'].includes(name)) return payment;
  if(['admin_apply_invoice_discount','admin_waive_invoice_due'].includes(name)) return invoice;
  if(name==='admin_update_staff_member') return staff;
  if(name==='admin_create_staff_invite') return {...invite,name:body.p_name,email:body.p_email,role:body.p_role};
  if(name==='admin_cancel_staff_invite'||name==='admin_update_clinic_settings'||name==='admin_record_report_export'||name==='record_admin_client_error') return name==='admin_update_clinic_settings'?clinic:null;
  if(name==='admin_get_management_overview') return {staff:[{...profile,activity:{}},{...staff,activity:{}}],pending_invites:[invite],storage:{total_files:1,stored_bytes:1024,original_bytes:2048,unknown_size_files:0,by_type:[]},subscription:{plan_name:'Free',status:'active',visit_limit:300},devices:{active_tokens:0,inactive_tokens:0,error_tokens:0},audit:[]};
  if(name==='admin_get_unified_audit') return [];
  if(name==='admin_get_archived_records') return [{record_type:'patient',record_id:PATIENT_ID,subject_name:patient.name,status:'archived',occurred_at:monthDate,reason:'test archive',actor_name:profile.name,amount:null}];
  if(name==='admin_get_release_health') return {client_errors_24h:0,client_errors_7d:0,paid_total_mismatches:0,due_total_mismatches:0};
  return [];
}
const countRpc=(name)=>rpcCalls.filter(x=>x.name===name).length;
const expectRpc=(name,min=1)=>{if(countRpc(name)<min) throw new Error(`Expected ${name} at least ${min} time(s), saw ${countRpc(name)}.`)};
async function nav(page,label){await page.locator('.admin-nav button').filter({hasText:label}).click();await page.getByRole('heading',{name:label,level:1,exact:true}).waitFor({state:'visible'});}
async function reasonAndConfirm(page,dialogName,confirmName,amount){
  const dialog=page.getByRole('dialog',{name:dialogName}); await dialog.waitFor();
  if(amount!==undefined){const amountInput=dialog.getByLabel('Amount'); if(await amountInput.count()) await amountInput.fill(String(amount));}
  await dialog.getByLabel('Reason').fill('Interaction certification');
  await dialog.getByRole('button',{name:confirmName}).click();
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
page.on('dialog',async d=>d.accept('Interaction certification reason'));
const pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
try{
  await page.route('**/auth/v1/token?grant_type=password',r=>json(r,{access_token:'mock-access-token',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,refresh_token:'mock-refresh-token',user:authUser}));
  await page.route('**/auth/v1/user',r=>json(r,authUser)); await page.route('**/auth/v1/logout',r=>json(r,{}));
  await page.route('**/storage/v1/object/sign/**',r=>json(r,{signedURL:'https://example.invalid/signed.jpg'}));
  await page.route('**/rest/v1/**',r=>{const url=new URL(r.request().url()),resource=url.pathname.split('/rest/v1/')[1]||'';return resource.startsWith('rpc/')?json(r,rpc(resource.slice(4),bodyOf(r))):json(r,table(resource,url));});
  await page.goto(baseUrl,{waitUntil:'networkidle'}); await page.getByLabel('Account email').fill(authUser.email); await page.getByLabel('Password').fill('mock-password'); await page.getByRole('button',{name:'Sign in as owner / head doctor'}).click(); await page.getByRole('heading',{name:'Clinic performance',level:1}).waitFor();

  await nav(page,'Patients'); await page.locator('.patient-row').first().click(); await page.getByRole('button',{name:'Edit record',exact:true}).click(); await page.getByLabel('Name').fill('Demo Patient Updated'); await page.getByLabel('Reason for modification').fill('Interaction certification'); await page.getByRole('button',{name:'Save audited changes',exact:true}).click(); await page.getByText('Patient record updated and added to the audit history.').waitFor(); expectRpc('admin_update_patient'); const archive=page.getByRole('button',{name:'Archive',exact:true}); await archive.click(); await page.getByText('Patient archived with an audit entry.').waitFor(); expectRpc('admin_set_patient_archived');

  await nav(page,'Appointments'); await page.getByRole('button',{name:'+ New appointment',exact:true}).click(); await page.getByLabel('Patient').selectOption(PATIENT_ID); await page.getByLabel('Reason for creation').fill('Interaction certification'); await page.getByRole('button',{name:'Create appointment',exact:true}).click(); expectRpc('admin_create_appointment'); await page.locator('.appointment-list button').first().click(); await page.getByLabel('Notes').fill('Updated appointment note'); await page.getByLabel('Reason for modification').fill('Interaction certification'); await page.getByRole('button',{name:'Save audited changes',exact:true}).click(); expectRpc('admin_update_appointment');

  await nav(page,'Visits & treatments'); await page.locator('.clinical-visit-list button').first().click(); await page.getByLabel('Diagnosis').fill('Updated diagnosis'); await page.getByLabel('Reason for modification').fill('Interaction certification'); await page.getByRole('button',{name:'Save audited visit changes',exact:true}).click(); expectRpc('admin_update_clinical_visit'); await page.getByRole('button',{name:'Edit clinical details',exact:true}).first().click(); await page.locator('.treatment-edit-form').getByLabel('Reason for modification').fill('Interaction certification'); await page.getByRole('button',{name:'Save treatment changes',exact:true}).click(); expectRpc('admin_update_clinical_treatment'); await page.locator('.tooth-cell').first().click(); await page.locator('.chart-correction-form').getByLabel('Reason for correction').fill('Interaction certification'); await page.getByRole('button',{name:'Append corrective chart entry',exact:true}).click(); expectRpc('admin_add_dental_chart_correction');

  await nav(page,'Gallery'); await page.locator('.gallery-card').first().click(); await page.locator('.gallery-archive-box textarea').fill('Interaction certification'); await page.getByRole('button',{name:'Archive file',exact:true}).click(); expectRpc('admin_set_file_archived');

  await nav(page,'Payments & invoices');
  await page.getByRole('button',{name:'Correct',exact:true}).first().click(); await reasonAndConfirm(page,'Correct payment entry','Confirm correct payment entry'); expectRpc('admin_correct_payment');
  await page.getByRole('button',{name:'Refund',exact:true}).first().click(); await reasonAndConfirm(page,'Issue patient refund','Confirm issue patient refund',50); expectRpc('admin_refund_payment');
  await page.getByRole('button',{name:'Void',exact:true}).first().click(); await reasonAndConfirm(page,'Void payment','Confirm void payment'); expectRpc('admin_void_payment');
  await page.getByRole('button',{name:'Invoice',exact:true}).first().click(); await page.getByRole('button',{name:'Apply discount',exact:true}).click(); await reasonAndConfirm(page,'Apply treatment discount','Confirm apply treatment discount',50); expectRpc('admin_apply_invoice_discount');
  await page.getByRole('button',{name:'Invoice',exact:true}).first().click(); await page.getByRole('button',{name:'Waive due',exact:true}).click(); await reasonAndConfirm(page,'Waive outstanding balance','Confirm waive outstanding balance',25); expectRpc('admin_waive_invoice_due');

  await nav(page,'Doctors & staff'); await page.getByRole('button',{name:'Manage',exact:true}).first().click(); await page.getByLabel('Modification reason').fill('Interaction certification'); await page.getByRole('button',{name:'Save audited changes',exact:true}).click(); expectRpc('admin_update_staff_member'); await page.getByRole('button',{name:'Invite staff',exact:true}).click(); await page.getByLabel('Name').fill('New Doctor'); await page.getByLabel('Invitation reason').fill('Interaction certification'); await page.getByRole('button',{name:'Create secure invite',exact:true}).click(); expectRpc('admin_create_staff_invite'); await page.getByRole('button',{name:'Done',exact:true}).click(); await page.locator('.management-invites').getByRole('button',{name:'Cancel',exact:true}).first().click(); await page.locator('.management-confirm textarea').fill('Interaction certification'); await page.getByRole('button',{name:'Cancel invitation',exact:true}).click(); expectRpc('admin_cancel_staff_invite');

  await nav(page,'Clinic settings'); await page.getByLabel('Modification reason').fill('Interaction certification'); await page.locator('.management-settings button[type="submit"]').click(); expectRpc('admin_update_clinic_settings');

  await nav(page,'Reports & exports'); await page.evaluate(()=>{window.print=()=>{window.__capdentPrinted=true;}}); const exportsBefore=countRpc('admin_record_report_export'); await page.getByRole('button',{name:'Download Excel workbook',exact:true}).click(); expectRpc('admin_record_report_export',exportsBefore+1); await page.getByRole('button',{name:'Print / Save PDF',exact:true}).click(); expectRpc('admin_record_report_export',exportsBefore+2); if(!await page.evaluate(()=>Boolean(window.__capdentPrinted))) throw new Error('Print / Save PDF did not invoke window.print().'); await page.getByRole('button',{name:'Data exports',exact:true}).click(); await page.getByRole('button',{name:'CSV',exact:true}).first().click(); expectRpc('admin_record_report_export',exportsBefore+3); await page.getByRole('button',{name:'Excel',exact:true}).first().click(); expectRpc('admin_record_report_export',exportsBefore+4); await page.getByRole('button',{name:'Unified audit',exact:true}).click(); await page.getByRole('button',{name:'Search audit',exact:true}).click(); expectRpc('admin_get_unified_audit'); await page.getByRole('button',{name:'Archived records',exact:true}).click(); await page.getByRole('button',{name:'Restore patient',exact:true}).click(); await page.getByLabel('Restoration reason').fill('Interaction certification'); await page.getByRole('button',{name:'Restore patient',exact:true}).last().click(); expectRpc('admin_set_patient_archived',2);

  const required=['admin_update_patient','admin_create_appointment','admin_update_appointment','admin_update_clinical_visit','admin_update_clinical_treatment','admin_add_dental_chart_correction','admin_set_file_archived','admin_correct_payment','admin_refund_payment','admin_void_payment','admin_apply_invoice_discount','admin_waive_invoice_due','admin_update_staff_member','admin_create_staff_invite','admin_cancel_staff_invite','admin_update_clinic_settings','admin_record_report_export']; for(const name of required) expectRpc(name);
  await page.getByRole('button',{name:'Sign out',exact:true}).click(); await page.getByRole('button',{name:'Sign in as owner / head doctor'}).waitFor({state:'visible'});
  if(pageErrors.length) throw new Error(`Interaction page errors: ${pageErrors.join(' | ')}`);
  console.log(`Clinic Admin full interaction certification passed with ${rpcCalls.length} mocked RPC calls.`);
}finally{await context.close();await browser.close();}
