import React, { useState } from 'react';
import { Play, Film } from 'lucide-react';
import Modal from './Modal';

export function fmtDuration(sec) {
  if (!sec || !isFinite(sec)) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// 16:9 preview picture with a play button on top. Falls back to a plain film icon
// if the thumbnail can't be loaded.
export function VideoThumb({ video, onPlay, className = '' }) {
  const [broken, setBroken] = useState(false);
  const dur = fmtDuration(video.duration);
  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={`Play ${video.title}`}
      className={`group relative block aspect-video w-full overflow-hidden bg-slate-100 ${className}`}
    >
      {video.thumbnailUrl && !broken ? (
        <img src={video.thumbnailUrl} alt="" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-300">
          <Film className="h-10 w-10" strokeWidth={1.5} />
        </div>
      )}
      <span className="absolute inset-0 grid place-items-center bg-slate-900/10 transition group-hover:bg-slate-900/25">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-brand-600 shadow-lg transition group-hover:scale-105">
          <Play className="ml-0.5 h-5 w-5 fill-current" />
        </span>
      </span>
      {dur && (
        <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/75 px-1.5 py-0.5 text-[11px] font-semibold text-white">{dur}</span>
      )}
    </button>
  );
}

// Plays one video in a dialog. Closing the dialog unmounts the player, which stops playback.
export function VideoPlayerModal({ video, onClose, protectDownload = false }) {
  return (
    <Modal open={!!video} onClose={onClose} title={video?.title || 'Video'} maxWidth="max-w-2xl">
      {video && (
        <>
          {video.source === 'youtube' && video.youtubeId ? (
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&playsinline=1`}
                title={video.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="h-full w-full border-0"
              />
            </div>
          ) : (
            <video
              src={video.url}
              poster={video.thumbnailUrl || undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              controlsList={protectDownload ? 'nodownload' : undefined}
              className="w-full rounded-xl bg-black"
            />
          )}
          {video.description && <p className="whitespace-pre-line text-sm text-slate-600">{video.description}</p>}
        </>
      )}
    </Modal>
  );
}