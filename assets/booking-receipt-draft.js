/* Receipt state validation, loaded before manual-booking.js.
 * Opaque fetch completion never proves acceptance.
 */
function createBookingReceiptClient(deps) {
  var saved=null, generation=0, contexts=[];
  function begin(fields) {
    var payload=JSON.stringify(fields);
    if (saved && saved.payload===payload) return JSON.parse(JSON.stringify(saved.request));
    // Changed form -> a NEW ID; never silently reuse an old ID with new data.
    generation++;contexts=[];
    var request=Object.assign({},fields,{action:'bookingV2',requestId:deps.randomHex(32),receiptCapability:deps.randomHex(64)});
    var candidate={payload:payload,request:request};
    // Persist before transmitting, so refresh/interruption can recover status.
    deps.save(JSON.stringify(candidate));
    saved=candidate;
    return JSON.parse(JSON.stringify(request));
  }
  function recover() {var raw=deps.load();if(!raw)return null;
    try {var candidate=JSON.parse(raw);if(!candidate.request || !/^[a-f0-9]{32}$/.test(candidate.request.requestId) ||
      !/^[a-f0-9]{64}$/.test(candidate.request.receiptCapability))return null;saved=candidate;generation++;contexts=[];return JSON.parse(JSON.stringify(saved.request));}
    catch(e){return null;}}
  function beginStatus() {
    if(!saved)return null;
    var context={requestId:saved.request.requestId,generation:generation};contexts=[context];return context;
  }
  function view(receipt,context) {
    var unverified={kind:'UNVERIFIED',message:'Request receipt is not verified. Keep your details and retry or contact Andrea.'};
    if (!saved || !context || contexts.indexOf(context)===-1 || context.generation!==generation ||
      context.requestId!==saved.request.requestId || !deps.isTrustedReceiptResult ||
      !deps.isTrustedReceiptResult(receipt,context)) return unverified;
    // Only the reviewed transport may mark a result trusted. Correlation is
    // also checked here; delayed results from a previous form are discarded.
    if (!receipt || receipt.requestId!==context.requestId || receipt.received!==true ||
      typeof receipt.bookingId!=='string' || !receipt.bookingId.trim() ||
      ['PENDING_DEPOSIT','PAYMENT_REVIEW','CONFIRMED','CANCELLED'].indexOf(receipt.state)===-1 ||
      (receipt.manualReview!==undefined && typeof receipt.manualReview!=='boolean')) return unverified;
    if(receipt.manualReview || receipt.state==='PAYMENT_REVIEW')
      return {kind:'REVIEW',message:'Andrea must review this request. Your appointment is not newly confirmed.'};
    if(receipt.state==='CONFIRMED')return {kind:'CONFIRMED',message:'Your appointment is confirmed.'};
    if(receipt.state==='CANCELLED')return {kind:'CANCELLED',message:'This appointment was cancelled.'};
    return {kind:'RECEIVED',message:'Request received. Deposit: $75 per person. Andrea will check your payment before confirming; your date is not reserved yet.'};
  }
  return {begin:begin,recover:recover,beginStatus:beginStatus,view:view};
}
// For browser integration use crypto.getRandomValues to produce randomHex;
// scoped sessionStorage keeps receipt capability off public URLs/history until
// a reviewed status transport is selected. Do not use Math.random or log it.
