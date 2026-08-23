import { ArrowDownToLine, BoxSelect, ChevronDown, Copy, Focus, Lock, RotateCcw, Save, Trash2, Unlock } from 'lucide-react'
import { JOINT_DEFINITIONS, JOINT_GROUPS, RIG_PRESET_GROUPS, RIG_PRESET_OPTIONS, normalizePoseId, poseCanLoop, poseForObject, presetJoints, presetPhase, presetRoot } from '../rig.js'
import { CAMERA_ID, FOCAL_LENGTH_PRESETS } from '../project.js'
import { GlobalSettingsPanel } from './GlobalSettingsPanel.jsx'
import { ToolButton, VectorFields } from './controls.jsx'

export function Inspector({ selected, camera, cameraAspect, onAspectChange, projectSettings, onApplySettings, maxKeyframeFrame, showGrid, onToggleGrid, performanceMode, onTogglePerformance, lighting, onLightingChange, selectedJoint, customPoses, onSelectJoint, onUpdateObject, onUpdateCamera, onDelete, onDuplicate, onFocus, onToggleLock, onGround, onResetRotation, onResetScale, onSaveCustomPose, onApplyCustomPose, onDeleteCustomPose }) {
  // 未选中物体：显示全局设置栏（画幅比例、时间轴、视口、光照等工程级设置）
  if (!selected) {
    return (
      <aside className="right-sidebar panel">
        <GlobalSettingsPanel cameraAspect={cameraAspect} onAspectChange={onAspectChange} projectSettings={projectSettings} onApplySettings={onApplySettings} maxKeyframeFrame={maxKeyframeFrame} showGrid={showGrid} onToggleGrid={onToggleGrid} performanceMode={performanceMode} onTogglePerformance={onTogglePerformance} lighting={lighting} onLightingChange={onLightingChange} />
      </aside>
    )
  }
  const isCamera = selected.id === CAMERA_ID
  const position = isCamera ? camera.position : selected.position
  const rigPose = selected.type === 'person' ? poseForObject(selected) : null
  const canLoopPose = selected.type === 'person' && poseCanLoop(selected.pose)
  const jointRotation = rigPose?.joints[selectedJoint] || [0, 0, 0]
  const updateJoint = rotation => onUpdateObject({
    joints: { ...rigPose.joints, [selectedJoint]: rotation },
  })
  const applyPreset = pose => onUpdateObject({
    pose: normalizePoseId(pose),
    poseTime: presetPhase(pose),
    continuousMotion: poseCanLoop(pose) ? Boolean(selected.continuousMotion) : false,
    rigRoot: presetRoot(pose),
    joints: presetJoints(pose),
  })
  return (
    <aside className="right-sidebar panel">
      <div className="inspector-head">
        <div>{isCamera ? <strong>主摄像机</strong> : <input className="inspector-name-input" value={selected.name} onChange={event => onUpdateObject({ name: event.target.value })} aria-label="物体名称" />}</div>
        <div className="inspector-head-actions">
          <ToolButton icon={Focus} label="视图聚焦" onClick={onFocus} />
          {!isCamera && <ToolButton icon={selected.locked ? Unlock : Lock} label={selected.locked ? '解除锁定' : '锁定'} onClick={onToggleLock} />}
          {!isCamera && <ToolButton icon={Copy} label="复制" onClick={onDuplicate} />}
          {!isCamera && <ToolButton icon={Trash2} label="删除" onClick={onDelete} />}
        </div>
      </div>
      <div className="inspector-scroll">
        {!isCamera && selected.locked && <div className="locked-banner"><Lock size={12} /> 已锁定空间变换</div>}
        <div className="inspector-section">
          <div className="section-title"><span>变换</span><ChevronDown size={14} /></div>
          <VectorFields title="位置" value={position} onChange={value => isCamera ? onUpdateCamera({ position: value }) : onUpdateObject({ position: value })} disabled={!isCamera && selected.locked} />
          {isCamera
            ? <VectorFields title="摄像机旋转 · X 俯仰 / Y 水平 / Z 翻滚" value={camera.rotation} degrees onChange={rotation => onUpdateCamera({ rotation })} />
            : <VectorFields title={selected.type === 'person' ? '整体旋转 · X 纵向 / Y 水平 / Z 翻滚' : '旋转'} value={selected.rotation} degrees onChange={rotation => onUpdateObject({ rotation })} disabled={selected.locked} />}
          {!isCamera && <VectorFields
            title="缩放"
            kind="scale"
            value={selected.scale}
            proportionalScale={Boolean(selected.proportionalScale)}
            scaleAxisLocks={Array.isArray(selected.scaleAxisLocks) ? selected.scaleAxisLocks : [false, false, false]}
            onToggleProportionalScale={() => onUpdateObject({ proportionalScale: !selected.proportionalScale })}
            onToggleScaleAxis={axis => {
              const locks = Array.isArray(selected.scaleAxisLocks) ? [...selected.scaleAxisLocks] : [false, false, false]
              locks[axis] = !locks[axis]
              onUpdateObject({ scaleAxisLocks: locks })
            }}
            onChange={scale => onUpdateObject({ scale })}
            disabled={selected.locked}
          />}
          {!isCamera && <div className="transform-quick-actions">
            <button type="button" onClick={onGround} disabled={selected.locked} title="按当前外形将物体最低点贴到世界地面"><ArrowDownToLine size={11} /> 落到地面</button>
            <button type="button" onClick={onResetRotation} disabled={selected.locked} title="保持位置和缩放，将整体旋转恢复为零"><RotateCcw size={11} /> 旋转归零</button>
            <button type="button" onClick={onResetScale} disabled={selected.locked} title="保持位置和旋转，将缩放恢复为 1"><BoxSelect size={11} /> 缩放归一</button>
          </div>}
        </div>
        {isCamera ? (
          <div className="inspector-section">
            <div className="section-title"><span>镜头</span><ChevronDown size={14} /></div>
            <label className="range-field"><span>焦距</span><input type="range" min="18" max="120" value={camera.focalLength} onChange={e => onUpdateCamera({ focalLength: Number(e.target.value) })} /><output>{Math.round(camera.focalLength)} mm</output></label>
            <div className="focal-presets" aria-label="常用焦距">
              {FOCAL_LENGTH_PRESETS.map(value => <button type="button" key={value} className={Math.round(camera.focalLength) === value ? 'is-active' : ''} onClick={() => onUpdateCamera({ focalLength: value })}>{value}</button>)}
            </div>
          </div>
        ) : selected.type === 'person' ? (
          <div className="inspector-section">
            <div className="section-title"><span>人物</span><ChevronDown size={14} /></div>

            <div className="inspector-subgroup">
              <label className="color-field"><span>人物颜色</span><input type="color" value={selected.color || '#e8e3d8'} onChange={e => onUpdateObject({ color: e.target.value })} /><output>{selected.color || '#e8e3d8'}</output></label>
              <label className="select-field"><span>体型</span><select value={selected.bodyType} onChange={e => onUpdateObject({ bodyType: e.target.value })}><option value="standard">中性人体</option><option value="female">女性人体</option><option value="male">男性人体</option><option value="tall">修长人体</option><option value="broad">宽体人体</option></select></label>
              <label className="select-field"><span>动作预设</span><select value={normalizePoseId(selected.pose)} onChange={e => applyPreset(e.target.value)}>{RIG_PRESET_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="range-field pose-time-field"><span>动作相位</span><input type="range" min="0" max="1" step="0.01" value={Number.isFinite(selected.poseTime) ? selected.poseTime : presetPhase(selected.pose)} onChange={e => onUpdateObject({ poseTime: Number(e.target.value) })} /><output>{Math.round((Number.isFinite(selected.poseTime) ? selected.poseTime : presetPhase(selected.pose)) * 100)}%</output></label>
              <label className={`motion-loop-control ${canLoopPose ? '' : 'is-disabled'}`}>
                <input type="checkbox" checked={canLoopPose && Boolean(selected.continuousMotion)} disabled={!canLoopPose} onChange={event => onUpdateObject({ continuousMotion: event.target.checked })} />
                <span><strong>随时间轴循环动作</strong><small>{canLoopPose ? '播放、拖帧和导出时持续循环' : '当前预设是固定姿势，不支持循环'}</small></span>
              </label>
              <p className="pose-source-note">角色状态关键帧会记录动作、相位、循环开关和完整骨骼，并在对应帧切换。动作来源：Three.js X-Bot 与 CC0 日常动作；当前模型没有面部表情。</p>
            </div>

            <div className="inspector-subgroup">
              <div className="pose-library">
                <div className="pose-library-head"><span>动作库</span><small>{RIG_PRESET_OPTIONS.length} 个</small></div>
                {RIG_PRESET_GROUPS.map(group => (
                  <div className="pose-group" key={group.label}>
                    <div className="pose-group-label">{group.label}</div>
                    <div className="pose-grid">
                      {group.poses.map(([value, label]) => (
                        <button key={value} type="button" data-pose={value} className={normalizePoseId(selected.pose) === value ? 'is-active' : ''} onClick={() => applyPreset(value)} title={`${group.label} · ${label}`}>
                          <span className="pose-figure"><i /><i /><i /></span>
                          <strong>{label}</strong>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="inspector-subgroup">
              <div className="joint-editor">
                <div className="joint-editor-head"><span>完整骨骼</span><small>{JOINT_DEFINITIONS.length} 根均可旋转</small></div>
                <label className="select-field"><span>当前骨骼</span><select value={selectedJoint} onChange={event => onSelectJoint(event.target.value)}>{JOINT_GROUPS.map(group => <optgroup key={group.label} label={group.label}>{group.joints.map(joint => <option key={joint.id} value={joint.id}>{joint.label}</option>)}</optgroup>)}</select></label>
                <VectorFields title="关节旋转" value={jointRotation} degrees onChange={updateJoint} />
                <button type="button" className="joint-reset-button" onClick={() => updateJoint([0, 0, 0])}>重置当前关节</button>
                <button type="button" className="joint-reset-button" onClick={() => onUpdateObject({ joints: presetJoints(selected.pose) })}>重置全部骨骼</button>
                <p className="joint-editor-hint">按 Q 后拖动青绿色的手脚控制点可摆放四肢末端；拖动人物其他部位或金色骨骼点可旋转单根骨骼。按住 Shift 左右拖可调整单骨骼扭转，也可使用 X/Y/Z 滑块微调。</p>
                <label className="foot-lock-control">
                  <input type="checkbox" checked={Boolean(selected.footLock)} onChange={event => onUpdateObject({ footLock: event.target.checked })} />
                  <span><strong>脚底锁定</strong><small>脚部 IK 保持当前脚底高度，只沿地面拖动</small></span>
                </label>
              </div>
            </div>

            <div className="inspector-subgroup">
              <div className="custom-pose-library">
                <div className="joint-editor-head"><span>我的姿势</span><small>{customPoses.length} 个</small></div>
                <button type="button" className="save-custom-pose" onClick={() => onSaveCustomPose(selected)}><Save size={12} /> 保存当前姿势</button>
                {customPoses.length ? (
                  <div className="custom-pose-list">
                    {customPoses.map(customPose => (
                      <div className="custom-pose-row" key={customPose.id}>
                        <button type="button" onClick={() => onApplyCustomPose(customPose)} title={`应用“${customPose.name}”`}>{customPose.name}</button>
                        <button type="button" className="custom-pose-delete" onClick={() => onDeleteCustomPose(customPose.id)} title={`删除“${customPose.name}”`} aria-label={`删除“${customPose.name}”`}><Trash2 size={11} /></button>
                      </div>
                    ))}
                  </div>
                ) : <p className="custom-pose-empty">还没有保存的姿势。调整骨骼后可存入本机姿势库。</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="inspector-section">
            <div className="section-title"><span>外观</span><ChevronDown size={14} /></div>
            <label className="color-field"><span>白模材质</span><input type="color" value={selected.color || '#d8d3c8'} onChange={e => onUpdateObject({ color: e.target.value })} /><output>{selected.color || '#d8d3c8'}</output></label>
          </div>
        )}
      </div>
    </aside>
  )
}
