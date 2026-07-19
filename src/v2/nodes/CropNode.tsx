// CropNode - 裁剪节点
// 原版函数名: eo (L5931-L6032)
import { memo, useState, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Check, X } from 'lucide-react';
import NodeTitle from './NodeTitle';
import type { AppNode } from '../types';

// TODO: ReactCrop 组件 - 需要安装 react-image-crop
// import ReactCrop, { type Crop } from 'react-image-crop';
// TODO: getCroppedCanvas 函数
// import { getCroppedCanvas } from '../utils/cropUtils';
// TODO: centerCrop, convertToPixelCrop 函数
// import { centerCrop, convertToPixelCrop } from 'react-image-crop';

interface CropNodeData {
  imageUrl?: string;
  onCropComplete?: (nodeId: string, canvas: HTMLCanvasElement) => void;
  onCancel?: (nodeId: string) => void;
  [key: string]: unknown;
}

function CropNode({ id, data, selected }: NodeProps<AppNode>) {
  const nodeData = data as unknown as CropNodeData;

  // TODO: 替换为真实 Crop 类型
  // const [crop, setCrop] = useState<Crop>();
  const [crop, setCrop] = useState<unknown>();
  const [completedCrop, setCompletedCrop] = useState<unknown>();
  const imgRef = useRef<HTMLImageElement>(null);

  return (
    <div className={`relative flex flex-col ${selected ? `z-50` : `z-40`}`}>
      <NodeTitle
        id={id}
        data={data}
        defaultTitle={`裁剪模式`}
        icon={
          <span className={`text-gray-500`}>
            ✂️
          </span>
        }
      />
      <div className={`relative bg-[#1c1c1c] rounded-xl overflow-hidden border shadow-xl transition-all duration-300 ${selected ? `border-[#555]` : `border-[#333] hover:border-[#444]`}`}>
        <div className={`p-2 bg-[#2a2a2a] flex justify-end items-center border-b border-[#333]`}>
          <div className={`flex gap-2`}>
            <button
              onClick={async () => {
                if (completedCrop && imgRef.current && nodeData.onCropComplete && (completedCrop as { width?: number }).width && (completedCrop as { height?: number }).height) {
                  try {
                    // TODO: 替换为真实的 getCroppedCanvas 调用
                    // const canvas = await getCroppedCanvas(imgRef.current, completedCrop);
                    // nodeData.onCropComplete(id, canvas);
                    console.warn('TODO: getCroppedCanvas not implemented');
                  } catch (e) {
                    console.error(`Crop failed`, e);
                  }
                }
              }}
              className={`p-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-md transition-colors flex items-center gap-1`}
              title={`确认裁剪`}
            >
              <Check size={14} />
              <span className={`text-xs`}>确认</span>
            </button>
            <button
              onClick={() => {
                nodeData.onCancel && nodeData.onCancel(id);
              }}
              className={`p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-colors flex items-center gap-1`}
              title={`取消`}
            >
              <X size={14} />
              <span className={`text-xs`}>取消</span>
            </button>
          </div>
        </div>
        <div
          className={`p-4 bg-[#0d0c0c] min-w-[300px] min-h-[200px] flex items-center justify-center cursor-crosshair nodrag nowheel`}
          onMouseDownCapture={(e: React.MouseEvent) => e.stopPropagation()}
          onTouchStartCapture={(e: React.TouchEvent) => e.stopPropagation()}
          onWheelCapture={(e: React.WheelEvent) => e.stopPropagation()}
        >
          {nodeData.imageUrl ? (
            // TODO: 替换为真实的 ReactCrop 组件
            // <ReactCrop
            //   crop={crop as Crop}
            //   onChange={(c: Crop) => setCrop(c)}
            //   onComplete={(c: Crop) => setCompletedCrop(c)}
            //   aspect={undefined}
            //   minWidth={10}
            //   minHeight={10}
            //   ruleOfThirds={true}
            //   className={`max-w-full max-h-full`}
            // >
            //   <img
            //     ref={imgRef}
            //     src={nodeData.imageUrl}
            //     onLoad={(e: React.SyntheticEvent<HTMLImageElement>) => {
            //       const { width, height } = e.currentTarget;
            //       setCrop(centerCrop(
            //         { unit: `%`, width: 80 },
            //         width / height,
            //         width,
            //         height,
            //       ));
            //     }}
            //     alt={`Crop me`}
            //     className={`max-w-[600px] max-h-[600px] object-contain pointer-events-none select-none`}
            //     draggable={false}
            //   />
            // </ReactCrop>
            <div className={`text-gray-500 text-sm`}>TODO: ReactCrop 组件待集成</div>
          ) : (
            <div className={`text-gray-500 text-sm`}>等待输入图片...</div>
          )}
        </div>
        <Handle
          type={`target`}
          position={Position.Left}
          className={`!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`}
        />
        <Handle
          type={`source`}
          position={Position.Right}
          className={`!bg-[#666] !w-4 !h-4 !border-2 !border-[#333]`}
        />
      </div>
    </div>
  );
}

export default memo(CropNode);
