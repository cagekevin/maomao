// assetUploadApi 临时 stub：全景图导入。
// hostedAssetUrl / importWorkbenchLocalAssetFile 是 Nomi 把本地文件落盘成 URL 的接口。
// 这里给一个最小实现：file → objectURL，方便先跑通。之后接你自己的文件 API。

export interface WorkbenchLocalAsset {
  id: string;
  url: string;
  name: string;
}

export async function importWorkbenchLocalAssetFile(
  file: File,
  name: string
): Promise<WorkbenchLocalAsset> {
  const url = URL.createObjectURL(file);
  return {
    id: `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    name: name || file.name,
  };
}

export function hostedAssetUrl(asset: WorkbenchLocalAsset): string {
  return asset.url;
}
