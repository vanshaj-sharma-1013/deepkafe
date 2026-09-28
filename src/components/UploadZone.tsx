"use client";

import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg"];

interface UploadZoneProps {
  file: File | null;
  previewUrl: string | null;
  onFileSelect: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function UploadZone({
  file,
  previewUrl,
  onFileSelect,
  onClear,
  disabled,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const candidate = fileList[0];
      if (!ALLOWED_TYPES.includes(candidate.type)) {
        setError("Only PNG, JPG, and JPEG images are supported.");
        return;
      }
      setError(null);
      onFileSelect(candidate);
    },
    [onFileSelect]
  );

  return (
    <div className="flex w-full flex-col items-center">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />

      <button
        type="button"
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        className="rounded-md bg-[#3b6ea5] px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-[#2f5c8a] disabled:cursor-not-allowed disabled:opacity-60"
      >
        [ Upload an image ]
      </button>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative mt-5 flex h-72 w-full max-w-md items-center justify-center rounded-md border-2 bg-[#dbe8f5] transition-colors",
          isDragging ? "border-[#3b6ea5]" : "border-[#a9c6e3]"
        )}
      >
        {previewUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded preview"
              className="h-full w-full rounded-md object-contain p-2"
            />
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#3b6ea5] text-white shadow-md transition-colors hover:bg-[#2f5c8a] disabled:opacity-50"
              aria-label="Remove image"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <span className="text-lg text-[#5c7a9c]">[ IMAGE ]</span>
        )}
      </div>

      {file && (
        <p className="mt-2 text-sm text-[#5c7a9c]">{file.name}</p>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
