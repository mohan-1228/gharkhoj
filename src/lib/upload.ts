import { api } from "./api-client";
import type { UploadKind } from "./constants";

interface Presigned {
  url: string;
  fields: Record<string, string>;
  key: string;
}

/**
 * Direct browser → S3 upload: presign on our API, POST the file straight to
 * S3/MinIO (the app server never proxies bytes), report progress.
 */
export async function uploadFile(
  file: File,
  kind: UploadKind,
  listingId: string | undefined,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const presigned = await api<Presigned>("/uploads/presign", {
    method: "POST",
    json: { kind, listingId, contentType: file.type, size: file.size },
  });
  const form = new FormData();
  for (const [k, v] of Object.entries(presigned.fields)) form.append(k, v);
  form.append("file", file); // must be the last field

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", presigned.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
  return presigned.key;
}
