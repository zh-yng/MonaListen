import type { UploadInput, UploadResult } from '@workspace/api-client-react';

export const servingUrl = (objectPath: string) => `/api/storage${objectPath}`;

export async function uploadBlob(
  request: (v: { data: UploadInput }) => Promise<UploadResult>,
  blob: Blob,
  name: string,
  contentType: string,
  onProgress?: (p: number) => void,
): Promise<string> {
  const { uploadURL, objectPath } = await request({ data: { name, size: blob.size, contentType } });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadURL);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error('Upload failed. The storage service could not be reached.'));
    xhr.send(blob);
  });
  return servingUrl(objectPath);
}
