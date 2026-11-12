export const VERSION='0.12.0';
export const BETS=Object.freeze([.1,.2,.4,.5,1,2,5,10,20,50,100,200,300,400,500]);
export const RULES=Object.freeze({reels:5,rows:5,spins:10,lives:3,duelRespins:10,startMultiplier:5,maxMultiplier:256,godMaxMultiplier:1024,maxWin:2500000});
export const multiplierCap=tier=>tier==='hidden'?RULES.godMaxMultiplier:RULES.maxMultiplier;
export const MODES=Object.freeze({base:{cost:1},enhanced:{cost:3},superAnte:{cost:6},duel:{cost:50},bonus:{cost:100,tier:'regular'},super:{cost:250,tier:'super'},mystery:{cost:250,tier:'random'}});
// Super Ante uses the existing ordinary Enhanced pool. At one bonus per 64 spins,
// these whole-billion ticket boundaries return 96.00% with the current pools.
const superAnteBonus=1/64, superAnteHidden=955248/1e9;
export const SUPER_ANTE_MIX=Object.freeze({super:superAnteBonus-superAnteHidden,hidden:superAnteHidden,enhanced:1-superAnteBonus});
export const FEATURE_SPINS=Object.freeze({
 enhanced:{name:'Enhanced Spins',color:'#ff941f'},
 superAnte:{name:'Super Ante',color:'#cf91ff'},
 duel:{name:'Duel Spins',color:'#58e3ee'}
});
export const MYSTERY_TIERS=Object.freeze({regular:.4,super:.5,hidden:.1});
export const poolOptions=pool=>['regular','super','hidden'].includes(pool)?{tier:pool}:pool==='duel'?{feature:'duel'}:{};
export const TIERS=Object.freeze({regular:{name:'SHOWDOWN',label:'Regular bonus',accent:'#ff993d'},super:{name:'LAST STAND',label:'Super bonus',accent:'#49e3e3'},hidden:{name:'GOD MODE',label:'Hidden bonus',accent:'#d7abff'}});
export const PAYTABLE=Object.freeze({HELMET:[20,60,125],GUN:[16,48,100],BLADE:[12,36,80],CHIP:[10,30,60],D:[6,18,40],U:[5,15,35],E:[4,12,30],L:[4,10,25]});
export const WORD_RULES=Object.freeze({letters:Object.freeze(['D','U','E','L']),award:10000,maxMultiplier:5});
export const LABELS={HELMET:'Hunter helmet',GUN:'Pulse revolver',BLADE:'Energy blade',CHIP:'Bounty chip',D:'D',U:'U',E:'E',L:'L',VS:'VS Duel Block',WILD:'Wild',SCATTER:'Bounty Vault'};
export const LINES=Object.freeze([
 [0,0,0,0,0],[1,1,1,1,1],[2,2,2,2,2],[3,3,3,3,3],[4,4,4,4,4],
 [0,1,2,3,4],[4,3,2,1,0],[0,1,2,1,0],[4,3,2,3,4],[2,1,0,1,2],
 [2,3,4,3,2],[0,0,1,0,0],[4,4,3,4,4],[1,2,3,2,1],[3,2,1,2,3],
 // Short zigzags connect adjacent rows, including the previously missing 3-2-3 L path.
 [0,1,0,1,0],[4,3,4,3,4],[1,0,1,0,1],[3,4,3,4,3],
 [1,2,1,2,1],[3,2,3,2,3],[2,1,2,1,2],[2,3,2,3,2],
 [0,0,1,1,0],[4,4,3,3,4],[1,1,0,0,1],[3,3,4,4,3],
 [1,1,2,2,1],[3,3,2,2,3],[2,2,1,1,2],[2,2,3,3,2],
 [0,1,1,1,0],[4,3,3,3,4],[1,0,0,0,1],[3,4,4,4,3],
 [1,2,2,2,1],[3,2,2,2,3],[2,1,1,1,2],[2,3,3,3,2],
 [0,0,0,1,2],[4,4,4,3,2],[0,1,2,2,2],[4,3,2,2,2],
 [2,2,2,1,0],[2,2,2,3,4],[2,1,0,0,0],[2,3,4,4,4],
 [0,1,2,3,3],[4,3,2,1,1],[2,1,2,3,2]
].map(Object.freeze));
export function quote(stake,mode='base'){
 if(!Object.hasOwn(MODES,mode)||!Number.isSafeInteger(stake)||stake<=0||stake>BETS.at(-1)*1e6||!Number.isSafeInteger(stake*MODES[mode].cost))throw Error('Invalid bet.');
 return {stake,mode,cost:stake*MODES[mode].cost};
}
export function cashWin(stake,payout){
 if(!Number.isSafeInteger(stake)||stake<=0||!Number.isSafeInteger(payout)||payout<0||payout>RULES.maxWin)throw Error('Invalid award.');
 const units=BigInt(stake)*BigInt(payout)/100n;
 if(units>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Award exceeds supported amount.');
 return Number(units);
}
