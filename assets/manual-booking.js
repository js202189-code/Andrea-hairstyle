/* Reviewed booking transport: JSONP result provenance + current-request binding.
 * No payment API. Credentials/capability never logged. Loaded after receipt client.
 */
function secureBookingHex(length){const bytes=new Uint8Array(length/2);crypto.getRandomValues(bytes);return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
function createManualBookingTransport(deps){
  const trusted=new WeakSet();
  const client=createBookingReceiptClient({randomHex:deps.randomHex||secureBookingHex,save:deps.save,load:deps.load,
    isTrustedReceiptResult:receipt=>receipt && trusted.has(receipt)});
  let lastReceipt=null;
  async function read(request){const context=client.beginStatus();
    const params=new URLSearchParams({action:'bookingReceipt',requestId:request.requestId,receiptCapability:request.receiptCapability});
    const receipt=await deps.read(params);if(receipt && typeof receipt==='object')trusted.add(receipt);
    const view=client.view(receipt,context);if(view.kind!=='UNVERIFIED')lastReceipt=receipt;
    return {view:view,receipt:receipt};}
  async function submit(fields){
    if(fields.services && fields.services.every(s=>s.id==='bridal-party')){
      const parent=client.recover();
      const retryFields=parent && parent.parentBookingId ? Object.assign({},fields,{parentBookingId:parent.parentBookingId,ownerCapability:parent.ownerCapability}) : null;
      const previousFields=parent && Object.assign({},parent);if(previousFields){delete previousFields.action;delete previousFields.requestId;delete previousFields.receiptCapability;}
      if(retryFields && JSON.stringify(retryFields)===JSON.stringify(previousFields))fields=retryFields;
      else {
      if(!parent || !lastReceipt || lastReceipt.requestId!==parent.requestId || lastReceipt.state!=='CONFIRMED' || lastReceipt.manualReview)throw Error('CONFIRMED_PARENT_REQUIRED');
      fields=Object.assign({},fields,{parentBookingId:lastReceipt.bookingId,ownerCapability:parent.receiptCapability});
      }
    }
    const request=client.begin(fields);let uncertain=false;
    try{await deps.post(request);}catch(e){uncertain=true;}
    // Opaque POST completion/error does not decide acceptance; durable read does.
    try{const result=await read(request);return Object.assign(result,{request:request,postUncertain:uncertain});}
    catch(e){return {request:request,view:client.view(null),postUncertain:true};}}
  async function recover(){const request=client.recover();if(!request)return null;try{return await read(request);}catch(e){return {view:client.view(null)};}}
  return {submit:submit,recover:recover};
}
