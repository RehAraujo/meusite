// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { commerceMode, verifiedCredential, validProviderOrder } from '../worker/commerce/credentials.js';
import { handleCommerce, matchesOrder, hash } from '../worker/commerce/handler.js';
import production from '../worker/commerce/production.js';
const env=()=>({COMMERCE_ENVIRONMENT:'production',COMMERCE_MODE:'production',COMMERCE_ORIGIN:'https://shopping.renatajoin.com',COMMERCE_PRODUCTION_ORIGIN:'https://shopping.renatajoin.com',COMMERCE_SELLER_ID:'123456789',COMMERCE_APPLICATION_ID:'987654321',MERCADOPAGO_ACCESS_TOKEN:'APP_USR-synthetic-only'});
const row={id:'32a6f0a0-2759-4ca1-a1be-c808c34921d1',mp_id:'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9',product_title:'Meu Dinheiro, Minhas Regras',amount_cents:4700,currency:'BRL'};
const remote=()=>({id:row.mp_id,user_id:'123456789',integration_data:{application_id:'987654321'},type:'online',processing_mode:'manual',external_reference:row.id,currency:'BRL',total_amount:'47.00',live_mode:true,items:[{title:row.product_title,quantity:1,unit_price:'47.00'}]});
afterEach(()=>vi.unstubAllGlobals());
async function disabledWebhook(config, { signatureValid = true, age = 0, topic = 'order', body = '{"type":"order"}' } = {}) {
 const id = 'ORD01KS5AJ6HTK2HRQ3XJ3C2JCKP9', requestId = 'disabled-signature-test';
 const ts = String(Date.now() - age);
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(config.MERCADOPAGO_WEBHOOK_SECRET || 'missing'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
 const hex = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`))).toString('hex');
 return new Request(config.COMMERCE_ORIGIN + `/api/commerce/webhook?data.id=${id}&type=${topic}`, {
  method: 'POST', headers: { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${signatureValid ? hex : '0'.repeat(64)}` }, body,
 });
}
it('validates disabled production notifications without reading bodies, bindings or provider APIs', async () => {
 const external = vi.fn(() => { throw new Error('Unexpected outbound call'); });
 vi.stubGlobal('fetch', external);
 const config = { ...env(), COMMERCE_MODE: 'disabled', MERCADOPAGO_WEBHOOK_SECRET: 'synthetic-secret' };
 for (const name of ['COMMERCE_DB', 'DIGITAL_PRODUCTS', 'MERCADOPAGO_ACCESS_TOKEN']) Object.defineProperty(config, name, { get() { throw new Error('Commercial binding accessed'); } });
 for (const topic of ['order', 'chargebacks', 'refunds']) {
  const request = await disabledWebhook(config, { topic, body: 'deliberately not JSON' });
  const response = await production.fetch(request, config);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ received: true, signature_verified: true, commerce_processed: false, mode: 'disabled' });
  expect(request.bodyUsed).toBe(false);
 }
 expect(external).not.toHaveBeenCalled();
});
it('rejects forged, expired and missing-secret notifications while disabled', async () => {
 const config = { ...env(), COMMERCE_MODE: 'disabled', MERCADOPAGO_WEBHOOK_SECRET: 'synthetic-secret' };
 for (const options of [{ signatureValid: false }, { age: 6 * 60000 }]) expect((await production.fetch(await disabledWebhook(config, options), config)).status).toBe(401);
 expect((await production.fetch(await disabledWebhook(config), { ...config, MERCADOPAGO_WEBHOOK_SECRET: undefined })).status).toBe(401);
 expect((await production.fetch(new Request(config.COMMERCE_ORIGIN + '/api/commerce/webhook', { method: 'POST' }), config)).status).toBe(401);
});
it('keeps checkout, order access, downloads and disabled staging blocked', async () => {
 const config = { ...env(), COMMERCE_MODE: 'disabled', MERCADOPAGO_WEBHOOK_SECRET: 'synthetic-secret' };
 for (const path of ['/checkout', `/orders/${row.id}`, `/orders/${row.id}/download`]) {
  const response = await production.fetch(new Request(config.COMMERCE_ORIGIN + '/api/commerce' + path, { method: path === '/checkout' ? 'POST' : 'GET' }), config);
  expect(response.status).toBe(503);
 }
 expect((await handleCommerce(await disabledWebhook(config), { ...config, COMMERCE_ENVIRONMENT: 'staging' })).status).toBe(503);
});
it('requires explicit production configuration and never fetches with disabled/mixed configuration',async()=>{
 for(const patch of [{COMMERCE_MODE:'disabled'},{COMMERCE_MODE:'test'},{COMMERCE_ENVIRONMENT:'staging'},{COMMERCE_SELLER_ID:'3792015931'},{COMMERCE_SELLER_ID:''},{COMMERCE_APPLICATION_ID:''},{COMMERCE_PRODUCTION_ORIGIN:'https://homologacao.renatajoin.com'}]){
  const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
  const config={...env(),...patch};expect(commerceMode(config)).toBe(false);
  await expect(verifiedCredential(config)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled();
 }
});
it('verifies the independently configured real seller and rejects test, wrong seller and wrong country',async()=>{
 for(const account of [{id:123456789,site_id:'MLB',tags:[]},{id:123456789,site_id:'MLB',tags:['test_user']},{id:1,site_id:'MLB',tags:[]},{id:123456789,site_id:'MLA',tags:[]}]){
  vi.stubGlobal('fetch',vi.fn(async()=>Response.json(account)));
  if(account.id===123456789&&account.site_id==='MLB'&&!account.tags.includes('test_user')) expect(await verifiedCredential(env())).toBe(env().MERCADOPAGO_ACCESS_TOKEN);
  else await expect(verifiedCredential(env())).rejects.toThrow('identity');
 }
});
it('rejects sandbox Orders in production and real Orders in staging',()=>{
 expect(validProviderOrder({id:'ORDTST01KS5AJ6HTK2HRQ3XJ3C2JCKP9',live_mode:false},env())).toBe(false);
 expect(validProviderOrder(remote(),{COMMERCE_ENVIRONMENT:'staging'})).toBe(false);
 expect(matchesOrder(remote(),row,env())).toBe(true);
 for(const patch of [{user_id:'1'},{integration_data:{application_id:'1'}},{live_mode:false},{live_mode:'true'},{total_amount:'0.01'},{external_reference:'wrong'},{currency:'USD'},{items:[]},{items:[{title:'other',quantity:1,unit_price:'47.00'}]}])expect(matchesOrder({...remote(),...patch},row,env())).toBe(false);
});
it('denies disabled production checkout and wrong host without outbound calls',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 expect((await production.fetch(new Request(env().COMMERCE_ORIGIN+'/api/commerce/checkout',{method:'POST'}),{...env(),COMMERCE_MODE:'disabled'})).status).toBe(503);
 expect((await production.fetch(new Request('https://homologacao.renatajoin.com/api/commerce/catalog'),env())).status).toBe(503);
 expect(fetch).not.toHaveBeenCalled();
});
it('runs a signed production webhook offline, reconciling only matching seller/application/value',async()=>{
 const config={...env(),MERCADOPAGO_WEBHOOK_SECRET:'synthetic-secret',DIGITAL_PRODUCTS:{},COMMERCE_DB:{prepare(_sql){return {bind(..._args){return {first:async()=>({...row,token_hash:await hash('ab'.repeat(32)),status:'processed',status_detail:'accredited',access_expires:Date.now()+10000,delivery_blocked:0}),run:async()=>({meta:{changes:1}})};}};}}};
 const account={id:123456789,site_id:'MLB',tags:[]};
 const calls=[];
 vi.stubGlobal('fetch',vi.fn(async(url)=>{calls.push(url);return Response.json(url.includes('/users/me')?account:{...remote(),status:'processed',status_detail:'accredited',total_paid_amount:'47.00',last_updated_date:new Date(Date.now()-1000).toISOString()});}));
 const ts=String(Date.now()),reqId='offline-request';
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(config.MERCADOPAGO_WEBHOOK_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`id:${row.mp_id.toLowerCase()};request-id:${reqId};ts:${ts};`))).toString('hex');
 const req=new Request(config.COMMERCE_ORIGIN+`/api/commerce/webhook?data.id=${row.mp_id}&type=order`,{method:'POST',headers:{'Content-Type':'application/json','x-request-id':reqId,'x-signature':`ts=${ts},v1=${signature}`},body:JSON.stringify({type:'order',live_mode:true,data:{id:row.mp_id}})});
 expect((await handleCommerce(req,config)).status).toBe(200);
 expect(calls.every(url=>url.startsWith('https://api.'))).toBe(true);
});
