"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { UPLOAD_LIMITS } from "@/lib/constants";
import { uploadFile } from "@/lib/upload";

export function VerificationUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  return (
    <form
      className="mt-6 space-y-3 rounded-xl border p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!file) return;
        try {
          const key = await uploadFile(file, "verification_doc", undefined, setPct);
          await api("/landlord/verification", { method: "POST", json: { key } });
          toast.success("Submitted for review");
          router.refresh();
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setPct(null);
        }
      }}
    >
      <label htmlFor="doc" className="text-sm font-medium">
        Document (JPG, PNG or PDF, max 10 MB)
      </label>
      <input
        id="doc"
        type="file"
        accept={UPLOAD_LIMITS.verification_doc.types.join(",")}
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm"
        required
      />
      <Button type="submit" disabled={!file || pct !== null}>
        {pct !== null ? `Uploading ${pct}%…` : "Submit for verification"}
      </Button>
    </form>
  );
}
