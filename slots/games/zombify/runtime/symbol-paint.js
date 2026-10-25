// Preserve atlas crops when a symbol leaves its styled tile for an effect layer.
export function copySymbolPaint(source,target){
 const computed=source.ownerDocument.defaultView.getComputedStyle(source);
 for(const property of ['background-image','background-size','background-position','background-repeat','background-color','mask-image','mask-size','mask-position','mask-repeat','filter']){
  const value=computed.getPropertyValue(property);
  if(value)target.style.setProperty(property,value,'important');
 }
 return target;
}
