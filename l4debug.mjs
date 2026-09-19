import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as babel from '@babel/parser';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = __dirname;
const SRC = join(root, 'src');
const TESTS = join(root, 'tests');
const SOURCE_EXTS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
function toPosix(p){return p.replace(/\\/g,'/');}
function relOf(abs){return toPosix(abs.slice(root.length).replace(/^[/\\]/,''));}
function domainOf(fileAbs){
  const r=toPosix(fileAbs);
  if(r.includes('/tests/')||r.endsWith('/tests'))return 'tests';
  const mc=r.match(/\/src\/components\/([^/]+)\//); if(mc)return mc[1];
  const mh=r.match(/\/src\/(hooks)\//); if(mh)return 'hooks';
  if(r.includes('/src/base/'))return 'base';
  if(r.includes('/src/'))return 'app';
  return 'app';
}
function resolveSourceFile(abs){
  if(!abs) return null;
  try{ if(statSync(abs).isFile()) return abs; }catch{}
  const ext=extname(abs); const stem=SOURCE_EXTS.includes(ext)?abs.slice(0,abs.length-ext.length):abs;
  for(const e of SOURCE_EXTS){const c=stem+e; if(existsSync(c)&&statSync(c).isFile()) return c;}
  for(const e of SOURCE_EXTS){const c=join(abs,'index'+e); if(existsSync(c)) return c;}
  return null;
}
function resolveSpec(spec,fromFile){
  const d=dirname(fromFile);
  if(spec.startsWith('.')) return resolve(d,spec);
  if(spec.startsWith('@/')) return resolve(root,'src',spec.slice(2));
  if(spec.startsWith('/')) return resolve(SRC,spec.slice(1));
  return null;
}
function collectFiles(dir,acc=[]){ if(!existsSync(dir))return acc; for(const n of readdirSync(dir)){const full=join(dir,n); let st;try{st=statSync(full);}catch{continue;} if(st.isDirectory())collectFiles(full,acc); else if(SOURCE_EXTS.includes(extname(n)))acc.push(full);} return acc; }
function extractSpecs(code){ const specs=new Set(); try{ const ast=babel.parse(code,{sourceType:'unambiguous',plugins:['jsx','typescript','decorators-legacy'],errorRecovery:true}); const walk=(n)=>{ if(!n)return; if(Array.isArray(n)){n.forEach(walk);return;} if(n.type==='ImportDeclaration'&&n.source) specs.add(n.source.value); else if((n.type==='ExportNamedDeclaration'||n.type==='ExportAllDeclaration')&&n.source) specs.add(n.source.value); else if(n.type==='CallExpression'){const isReq=n.callee.type==='Identifier'&&n.callee.name==='require'; const isDI=n.callee.type==='Import'; if((isReq||isDI)&&n.arguments.length&&n.arguments[0].type==='StringLiteral') specs.add(n.arguments[0].value);} for(const k in n) if(typeof n[k]==='object'&&n[k]!==null&&k!=='loc'&&k!=='range') walk(n[k]); }; walk(ast.program);}catch{} return [...specs]; }

const allFiles=[...collectFiles(SRC),...collectFiles(TESTS)];
const reverse=new Map();
function addEdge(from,to){ if(!reverse.has(to))reverse.set(to,new Set()); reverse.get(to).add(from); }
for(const f of allFiles){ let code;try{code=readFileSync(f,'utf8');}catch{continue;} for(const spec of extractSpecs(code)){ const abs=resolveSpec(spec,f); if(!abs)continue; const t=resolveSourceFile(abs); if(!t||t===f)continue; addEdge(f,t); } }

function transitiveConsumers(F){ const seen=new Set([F]); const stack=[F]; while(stack.length){ const cur=stack.pop(); const ups=reverse.get(cur); if(!ups)continue; for(const u of ups){ if(!seen.has(u)){seen.add(u);stack.push(u);} } } seen.delete(F); return [...seen]; }

const targets=['src/components/base/core/agentKeys.ts','src/components/base/ui/attachmentCover.tsx','src/components/base/utils/videoEngine.ts','src/components/base/utils/imageUpscale.ts','src/components/agent/runtime/volumePolicy.ts'];
for(const t of targets){
  const abs=resolve(root,t);
  const real=resolveSourceFile(abs);
  if(!real){ console.log(`\n${t}\n  ✖ 解析不到真实文件`); continue; }
  const cons=transitiveConsumers(real);
  const byDom=new Map();
  for(const c of cons){ const d=domainOf(c); if(!byDom.has(d))byDom.set(d,0); byDom.set(d,byDom.get(d)+1); }
  console.log(`\n${t}`);
  console.log('  real=',relOf(real),' totalConsumers=',cons.length);
  console.log('  byDomain=',[...byDom.entries()].map(([d,n])=>`${d}:${n}`).join('  '));
}
