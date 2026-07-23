const fs=require('fs');
const tasks=[
  ['02','cropNode','CropNodeComp','gridSplitNode','GridSplitNodeComp','gridMergeNode','GridMergeNodeComp'],
  ['03','videoNode','VideoGenNodeComp','sd2VideoNode','SD2VideoNodeComp','discountVideoNode','DiscountVideoNodeComp'],
  ['04','audioNode','AudioTranscribeNodeComp','audioPlayerNode','AudioPlayerNodeComp','customNode','CustomNodeComp'],
  ['05','rhWebappNode','RhWebappNodeComp','videoExtractNode','VideoExtractNodeComp','videoToGifNode','VideoToGifNodeComp'],
  ['06','imageCompressNode','ImageCompressNodeComp','faceMosaicNode','FaceMosaicNodeComp','compareNode','CompareNodeComp'],
  ['07','textConcatNode','TextConcatNodeComp','urlToImageNode','UrlToImageNodeComp','fileToUrlNode','FileToUrlNodeComp'],
  ['08','panoramaNode','PanoramaNodeComp','director3dNode','Director3DNodeComp','imageBoxNode','ImageBoxNodeComp'],
];
for(const [n,t1,v1,t2,v2,t3,v3] of tasks){
  let f=fs.readFileSync('docs/annotate-body-tasks/AB'+n+'.md','utf-8');
  f=f.replace(/AB01 — 节点/g,'AB'+n+' — 节点');
  const newList=`1. **${t1}** (\`${v1}\`)\n2. **${t2}** (\`${v2}\`)\n3. **${t3}** (\`${v3}\`)`;
  f=f.replace(/1\. \*\*imageNode\*\*[\s\S]*?\n(?=## 参考)/,newList+'\n\n');
  fs.writeFileSync('docs/annotate-body-tasks/AB'+n+'.md',f);
  console.log('AB'+n+' done');
}
let f=fs.readFileSync('docs/annotate-body-tasks/AB09.md','utf-8');
f=f.replace(/AB01 — 节点/g,'AB09 — 节点');
f=f.replace(/1\. \*\*imageNode\*\*[\s\S]*?\n(?=## 参考)/,'1. **stickyNoteNode** (`StickyNoteNodeComp`)\n2. **group** (`GroupNodeComp`)\n3. **ghostTarget** (`Nh`)\n\n');
fs.writeFileSync('docs/annotate-body-tasks/AB09.md',f);
console.log('AB09 done');
