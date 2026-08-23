// ============================================================
// @tabler/icons-react → lucide-react 适配 stub
// tabler 用 `stroke={number}`，lucide 用 `strokeWidth`。这里统一包装转换。
// lucide 没有的图标用占位/近似图标，你在 scene3d-ui 里逐个换成想要的。
// 想彻底恢复 Nomi 原图标：`npm i @tabler/icons-react` 后删掉本 stub 并把 import 改回。
// ============================================================
import React from 'react'
import {
  Box, Bus, Car, Camera, Check, ChevronDown, ChevronRight, ChevronUp, Circle,
  CircleStop, Crosshair, Eye, EyeOff, Folder, FolderPlus, GripVertical, HelpCircle,
  Home, Image, Lamp, Link, ListTree, Maximize, Map, Minimize, Move, Package, Pause,
  PencilLine, Plane, Play, Plus, RotateCw, Route, Settings, SkipBack, SlidersHorizontal,
  Square, StopCircle, Table, Trash, Trees, Upload, User, Video, X, ZoomIn, MoreVertical,
} from 'lucide-react'

type TablerIconProps = {
  size?: number | string
  stroke?: number | string
  className?: string
  [key: string]: unknown
}

// 把 tabler 的 `stroke` 转成 lucide 的 `strokeWidth`。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptIcon(Component: any) {
  return function TablerIconAdapter(props: TablerIconProps) {
    const { stroke, ...rest } = props
    const next: Record<string, unknown> = {
      ...(stroke !== undefined ? { strokeWidth: stroke } : {}),
      ...rest,
    }
    return React.createElement(Component, next)
  }
}

export const IconPlus = adaptIcon(Plus)
export const IconCamera = adaptIcon(Camera)
export const IconX = adaptIcon(X)
export const IconChevronDown = adaptIcon(ChevronDown)
export const IconChevronRight = adaptIcon(ChevronRight)
export const IconChevronUp = adaptIcon(ChevronUp)
export const IconFolder = adaptIcon(Folder)
export const IconFolderPlus = adaptIcon(FolderPlus)
export const IconTrash = adaptIcon(Trash)
export const IconUser = adaptIcon(User)
export const IconEye = adaptIcon(Eye)
export const IconEyeOff = adaptIcon(EyeOff)
export const IconSettings = adaptIcon(Settings)
export const IconHelp = adaptIcon(HelpCircle)
export const IconMaximize = adaptIcon(Maximize)
export const IconMinimize = adaptIcon(Minimize)
export const IconPlayerPlay = adaptIcon(Play)
export const IconPlayerPause = adaptIcon(Pause)
export const IconPlayerSkipBack = adaptIcon(SkipBack)
export const IconPlayerStopFilled = adaptIcon(StopCircle)
export const IconPlayerRecord = adaptIcon(Circle)
export const IconRotate = adaptIcon(RotateCw)
export const IconBox = adaptIcon(Box)
export const IconSphere = adaptIcon(Circle)
export const IconCylinder = adaptIcon(Circle)
export const IconPlane = adaptIcon(Plane)
export const IconCar = adaptIcon(Car)
export const IconCarSuv = adaptIcon(Car)
export const IconBus = adaptIcon(Bus)
export const IconVideo = adaptIcon(Video)
export const IconLink = adaptIcon(Link)
export const IconUpload = adaptIcon(Upload)
export const IconPhoto = adaptIcon(Image)
export const IconRun = adaptIcon(Move)
export const IconMap2 = adaptIcon(Map)
export const IconRoute = adaptIcon(Route)
export const IconCube = adaptIcon(Box)
export const IconCircleFilled = adaptIcon(Circle)
export const IconFocusCentered = adaptIcon(Crosshair)
export const IconArrowsMove = adaptIcon(Move)
export const IconZoomScan = adaptIcon(ZoomIn)
export const IconMovie = adaptIcon(Video)
export const IconPackage = adaptIcon(Package)
export const IconTrees = adaptIcon(Trees)
export const IconLamp = adaptIcon(Lamp)
export const IconWall = adaptIcon(Square)
export const IconTable = adaptIcon(Table)
export const IconFridge = adaptIcon(Box)
export const IconWashMachine = adaptIcon(Box)
export const IconCreditCard = adaptIcon(Check)
export const IconBackpack = adaptIcon(Package)
export const IconBike = adaptIcon(GripVertical)
export const IconScooter = adaptIcon(GripVertical)
export const IconArmchair = adaptIcon(SlidersHorizontal)
export const IconDiningTable = adaptIcon(Table)
export const IconBulb = adaptIcon(Lamp)
export const IconBuildingSkyscraper = adaptIcon(Home)
export const IconManFilled = adaptIcon(User)
export const IconHandStop = adaptIcon(CircleStop)
export const IconArrowBarToDown = adaptIcon(ChevronDown)
export const IconArrowBarToUp = adaptIcon(ChevronUp)
export const IconListTree = adaptIcon(ListTree)
export const IconPencil = adaptIcon(PencilLine)
export const IconDotsVertical = adaptIcon(MoreVertical)

export type Icon = typeof IconPlus
