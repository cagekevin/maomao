import { memo, useState, useEffect, useMemo } from 'react';
import { useReactFlow, useHandleConnections, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';
import CustomHandle from './CustomHandle';
import NodeTitle from './NodeTitle';

// TODO: implement - hs: 根据节点对象提取文本内容
// const hs = (node: any): string | undefined => { ... };

interface TextConcatNodeData {
  separator?: string;
  prefix?: string;
  suffix?: string;
  text?: string;
  [key: string]: unknown;
}

const TextConcatNode = memo(({ id, data, selected }: NodeProps<{ data: TextConcatNodeData }>) => {
  const { updateNodeData } = useReactFlow();
  const connections = useHandleConnections({ type: 'target' });
  const sourceIds = useMemo(() => connections.map(e => e.source), [connections]);
  const [separator, setSeparator] = useState(data.separator === undefined ? '\n' : data.separator);
  const [prefix, setPrefix] = useState(data.prefix || '');
  const [suffix, setSuffix] = useState(data.suffix || '');

  // TODO: implement - hs: 根据节点对象提取文本内容
  const p = connections.map(e => (hs as any)(sourceIds.find(t => (t as any)?.id === e.source))).filter(e => e);
  const m = separator.replace(/\\n/g, '\n');
  const h = p.length > 0 ? `${prefix}${p.join(m)}${suffix}` : '';

  useEffect(() => {
    data.text !== h && updateNodeData(id, { text: h });
  }, [h, id, updateNodeData, data.text]);

  return (
    <div className="relative flex flex-col">
      <NodeTitle
        id={id}
        data={data}
        defaultTitle="文字拼接"
        icon={<FileText size={11} className="text-gray-500" />}
      />
      <div className={`w-[260px] bg-[#1a1a1a] rounded-xl shadow-2xl border-2 transition-colors ${selected ? 'border-[#555]' : 'border-[#333] hover:border-[#444]'}`}>
        <CustomHandle
          type="target"
          position={Position.Left}
        />
        <div className="p-3 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">前缀</label>
            <input
              type="text"
              value={prefix}
              onChange={t => {
                setPrefix(t.target.value);
                updateNodeData(id, { prefix: t.target.value });
              }}
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag"
              placeholder="可选"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">分隔符 (输入 \n 表示换行)</label>
            <input
              type="text"
              value={separator}
              onChange={t => {
                setSeparator(t.target.value);
                updateNodeData(id, { separator: t.target.value });
              }}
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500">后缀</label>
            <input
              type="text"
              value={suffix}
              onChange={t => {
                setSuffix(t.target.value);
                updateNodeData(id, { suffix: t.target.value });
              }}
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-gray-500 nodrag"
              placeholder="可选"
            />
          </div>
          <div className="space-y-1 pt-2 border-t border-[#333]">
            <label className="text-[10px] text-gray-500 flex justify-between">
              <span>拼接结果 ({p.length} 个输入)</span>
            </label>
            <textarea
              readOnly
              value={h}
              className="w-full bg-[#111] border border-[#333] rounded px-2 py-1 text-xs text-gray-300 h-[60px] resize-y custom-scrollbar"
              placeholder="等待连入文本..."
            />
          </div>
        </div>
        <CustomHandle
          type="source"
          position={Position.Right}
          id="text"
        />
      </div>
    </div>
  );
});

export default TextConcatNode;