import { useEffect, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import type { ProjectFile } from '../../types/domain';

function formatFileSize(size?: number) {
  if (!size) {
    return 'Stored record';
  }

  if (size < 1024 * 1024) {
    return size < 1024 ? '<1 KB' : `${Math.round(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function canPreviewFile(file: ProjectFile) {
  const fileType = file.type ?? '';
  const fileName = file.name.toLowerCase();

  return fileType.startsWith('image/') || fileType === 'application/pdf' || fileName.endsWith('.pdf');
}

function isImageFile(file: ProjectFile) {
  const fileType = file.type ?? '';
  const fileName = file.name.toLowerCase();

  return fileType.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg)$/.test(fileName);
}

function isPdfFile(file: ProjectFile) {
  const fileType = file.type ?? '';
  const fileName = file.name.toLowerCase();

  return fileType === 'application/pdf' || fileName.endsWith('.pdf');
}

export function FileGrid({
  files,
  taskFolders = [],
  isUploading,
  uploadError,
  canUpload = true,
  canDelete = false,
  onPreview,
  onDownload,
  onRename,
  onUpload,
  getThumbnailUrl,
  onDelete,
}: {
  files: ProjectFile[];
  taskFolders?: Array<{ id: string; label: string }>;
  isUploading?: boolean;
  uploadError?: string | null;
  canUpload?: boolean;
  canDelete?: boolean;
  onPreview?: (file: ProjectFile) => void;
  onDownload?: (file: ProjectFile) => void;
  onRename?: (file: ProjectFile, nextName: string) => void;
  onUpload?: (file: File, taskId?: string) => void;
  getThumbnailUrl?: (file: ProjectFile) => Promise<string | null>;
  onDelete?: (file: ProjectFile) => void;
}) {
  const [renamingFileKey, setRenamingFileKey] = useState<string | null>(null);
  const [nextFileName, setNextFileName] = useState('');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [isDragActive, setIsDragActive] = useState(false);
  const requestedThumbnailKeys = useRef(new Set<string>());

  const sortedFiles = [...files].sort((a, b) => {
    const byDate = (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '');
    return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
  });

  const rootFiles = sortedFiles.filter((file) => !file.taskId);
  const folders = taskFolders
    .map((folder) => ({ ...folder, files: sortedFiles.filter((file) => file.taskId === folder.id) }))
    .filter((folder) => folder.files.length > 0)
    .sort((a, b) => a.label.localeCompare(b.label));

  useEffect(() => {
    if (!getThumbnailUrl) {
      return;
    }

    files.forEach((file) => {
      const key = file.path ?? file.name;
      if (!file.path || !isImageFile(file) && !isPdfFile(file) || requestedThumbnailKeys.current.has(key)) {
        return;
      }

      requestedThumbnailKeys.current.add(key);
      getThumbnailUrl(file).then((url) => {
        if (url) {
          setThumbnails((current) => ({ ...current, [key]: url }));
        }
      }).catch(() => {
        requestedThumbnailKeys.current.delete(key);
      });
    });
  }, [files, getThumbnailUrl]);

  function renderFileCard(file: ProjectFile) {
    const key = file.path ?? file.name;
    const thumbnailUrl = thumbnails[key];
    const imageThumbnailUrl = thumbnailUrl && isImageFile(file) ? thumbnailUrl : null;
    const pdfFile = isPdfFile(file);

    return (
      <div key={`${key}-${file.uploadedAt ?? ''}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-200">
        {imageThumbnailUrl ? (
          <img src={imageThumbnailUrl} alt={file.name} className="mb-3 h-32 w-full rounded-xl object-cover" />
        ) : (
          <div className="mb-3 flex h-32 w-full items-center justify-center rounded-xl border border-dashed border-white/15 bg-slate-950/70 text-slate-500">
            <span className="text-xs uppercase tracking-[0.25em]">{pdfFile ? 'PDF file' : 'Preview unavailable'}</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          {imageThumbnailUrl ? null : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" />}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{file.name}</p>
            <p className="mt-1 text-xs text-slate-500">{formatFileSize(file.size)}</p>
          </div>
        </div>
        {file.path ? (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {canPreviewFile(file) ? (
              <button type="button" aria-label={`Preview ${file.name}`} onClick={() => onPreview?.(file)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-sky-200 transition hover:bg-white/10 hover:text-sky-100">
                Preview
              </button>
            ) : null}
            <button type="button" aria-label={`Download ${file.name}`} onClick={() => onDownload?.(file)} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-sky-200 transition hover:bg-white/10 hover:text-sky-100">
              Download
            </button>
            <button type="button" aria-label={`Rename ${file.name}`} onClick={() => { setRenamingFileKey(key); setNextFileName(file.name); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-sky-200 transition hover:bg-white/10 hover:text-sky-100">
              Rename
            </button>
            {canDelete ? (
              <button type="button" aria-label={`Delete ${file.name}`} onClick={() => onDelete?.(file)} className="rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 hover:text-red-200">
                Delete
              </button>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <p className="text-xs text-slate-500">Legacy file name only</p>
            <button type="button" onClick={() => { setRenamingFileKey(key); setNextFileName(file.name); }} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-sky-200 transition hover:bg-white/10 hover:text-sky-100">
              Rename
            </button>
            {canDelete ? (
              <button type="button" onClick={() => onDelete?.(file)} className="rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 hover:text-red-200">
                Delete
              </button>
            ) : null}
          </div>
        )}
        {renamingFileKey === key ? (
          <div className="mt-3 grid gap-2">
            <input value={nextFileName} onChange={(event) => setNextFileName(event.target.value)} className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-white outline-none focus:border-sky-400/50" />
            <div className="flex gap-2">
              <button type="button" disabled={!nextFileName.trim()} onClick={() => { onRename?.(file, nextFileName); setRenamingFileKey(null); }} className="rounded-xl bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50">Save</button>
              <button type="button" onClick={() => setRenamingFileKey(null)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Cancel</button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragActive(false);

    if (!canUpload || isUploading) {
      return;
    }

    Array.from(event.dataTransfer.files).forEach((file) => onUpload?.(file));
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-6 shadow-soft">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (canUpload && !isUploading) {
            setIsDragActive(true);
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => {
          if (event.currentTarget === event.target) {
            setIsDragActive(false);
          }
        }}
        onDrop={handleDrop}
        className={`rounded-2xl border border-dashed p-4 transition-colors ${isDragActive ? 'border-sky-300 bg-sky-400/15' : 'border-white/10 bg-slate-950/20'}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Files</h3>
          <p className="mt-1 text-sm text-slate-400">Drag files here or use the upload button. You can also upload directly into a rebrand stage below.</p>
        </div>
        {canUpload ? (
          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 aria-disabled:pointer-events-none aria-disabled:opacity-50" aria-disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload file'}
            <input
              type="file"
              disabled={isUploading}
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.dwg,.ai"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) {
                  onUpload?.(file);
                }
              }}
            />
          </label>
        ) : (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">View only</p>
        )}
        </div>
        {canUpload ? <p className={`mt-3 text-xs ${isDragActive ? 'text-sky-100' : 'text-slate-500'}`}>{isDragActive ? 'Release to upload' : 'Drop one or more files anywhere in this panel'}</p> : null}
      </div>

      {uploadError ? <p className="mt-3 text-sm text-red-300">{uploadError}</p> : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/35 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">General uploads</p>
          <span className="text-xs text-slate-500">{rootFiles.length} file{rootFiles.length === 1 ? '' : 's'}</span>
        </div>
        {rootFiles.length > 0 ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {rootFiles.map((file) => renderFileCard(file))}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-slate-950/40 p-5 text-sm text-slate-400">
            {folders.length > 0 ? 'No general files uploaded yet.' : 'No files uploaded yet.'}
          </div>
        )}
      </div>

      {folders.length > 0 ? (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Files by stage</p>
            <span className="text-xs text-slate-500">{folders.length} folder{folders.length === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-3">
            {folders.map((folder) => {
              return (
                <div key={folder.id} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 shrink-0 text-amber-200" />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">Stage: {folder.label}</span>
                    <span className="shrink-0 text-xs text-slate-400">{folder.files.length} file{folder.files.length === 1 ? '' : 's'}</span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {folder.files.map((file) => renderFileCard(file))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
