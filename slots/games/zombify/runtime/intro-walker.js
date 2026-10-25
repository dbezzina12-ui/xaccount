// The ident's skeletal character is not a reel symbol. Keeping a legacy
// `symbol art-zombie` host paints a second portrait behind its canvas whenever
// a theme overrides the symbol background (including important atlas rules).
export function createIntroWalker(container){
 const host=container.ownerDocument.createElement('div');
 host.className='approved-intro-walker';
 host.setAttribute('aria-hidden','true');
 container.replaceChildren(host);
 return host;
}
