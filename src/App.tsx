import { useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { FfprobeResult, MediaItem, ProjectFile, TimelineClip } from "./types";
import { fileName, formatBytes, formatFps, formatTime, getMediaKind, parseFrameRate } from "./lib";
import "./App.css";

const VIDEO_FILTERS = [{ name: "Video and audio", extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v", "mp3", "wav", "aac", "flac", "ogg", "m4a"] }];
const IMAGE_FILTERS = [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff"] }];

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function mediaFromProbe(path: string, probe: FfprobeResult): Omit<MediaItem, "id" | "status"> {
  const streams = probe.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  const duration = Number(probe.format?.duration);
  const size = Number(probe.format?.size);
  return {
    path,
    name: fileName(path),
    kind: video ? "video" : audio ? "audio" : getMediaKind(path),
    durationSeconds: Number.isFinite(duration) && duration >= 0 ? duration : null,
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: parseFrameRate(video?.avg_frame_rate || video?.r_frame_rate),
    sizeBytes: Number.isFinite(size) && size >= 0 ? size : null,
    formatName: probe.format?.format_name ?? null,
  };
}

export default function App() {
  const [projectName, setProjectName] = useState("Untitled Project");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [clips, setClips] = useState<TimelineClip[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [notice, setNotice] = useState("Ready");
  const [busy, setBusy] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectedMedia = media.find((item) => item.id === selectedMediaId) ?? null;
  const selectedClip = clips.find((clip) => clip.id === selectedClipId) ?? null;
  const previewMedia = selectedClip ? media.find((item) => item.id === selectedClip.mediaId) ?? null : selectedMedia;
  const previewUrl = previewMedia && (previewMedia.kind === "video" || previewMedia.kind === "audio" || previewMedia.kind === "image") ? convertFileSrc(previewMedia.path) : null;
  const totalDuration = useMemo(
    () => clips.reduce((max, clip) => Math.max(max, clip.startSeconds + Math.max(0, clip.sourceOutSeconds - clip.sourceInSeconds)), 0),
    [clips],
  );
  const timelineScale = Math.max(30, totalDuration || 30);

  useEffect(() => {
    setPreviewTime(0);
    setPreviewDuration(previewMedia?.durationSeconds ?? 0);
    setIsPlaying(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
  }, [previewUrl]);

  function togglePlayback() {
    const element = previewMedia?.kind === "audio" ? audioRef.current : videoRef.current;
    if (!element) return;
    if (element.paused) {
      void element.play().then(() => setIsPlaying(true)).catch((error) => setNotice(`Playback failed: ${String(error)}`));
    } else {
      element.pause();
      setIsPlaying(false);
    }
  }

  function seekPreview(nextTime: number) {
    const clamped = Math.max(0, Math.min(previewDuration || 0, nextTime));
    const element = previewMedia?.kind === "audio" ? audioRef.current : videoRef.current;
    if (element && Number.isFinite(clamped)) element.currentTime = clamped;
    setPreviewTime(clamped);
  }

  function stepFrame(direction: -1 | 1) {
    const fps = previewMedia?.fps && previewMedia.fps > 0 ? previewMedia.fps : 30;
    seekPreview(previewTime + direction / fps);
  }

  async function importMedia() {
    try {
      const selection = await open({ multiple: true, filters: [...VIDEO_FILTERS, ...IMAGE_FILTERS] });
      if (!selection) return;
      const paths = (Array.isArray(selection) ? selection : [selection]).filter((path) => !media.some((item) => item.path === path));
      if (!paths.length) {
        setNotice("Those files are already in the media bin.");
        return;
      }

      const pending: MediaItem[] = paths.map((path) => ({
        id: makeId(), path, name: fileName(path), kind: getMediaKind(path),
        durationSeconds: null, width: null, height: null, fps: null, sizeBytes: null,
        formatName: null, status: "loading",
      }));
      setMedia((current) => [...current, ...pending]);
      setSelectedMediaId(pending[0].id);
      setNotice(`Analyzing ${pending.length} file(s)…`);

      // Probe sequentially to avoid launching many FFprobe processes on low-spec machines.
      for (const item of pending) {
        try {
          const raw = await invoke<FfprobeResult>("probe_media", { path: item.path });
          const details = mediaFromProbe(item.path, raw);
          setMedia((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...details, status: "ready" } : entry));
        } catch (error) {
          setMedia((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "error", error: String(error) } : entry));
        }
      }
      setNotice("Media import complete.");
    } catch (error) {
      setNotice(`Import failed: ${String(error)}`);
    }
  }

  async function importImages() {
    try {
      const selection = await open({ multiple: true, filters: IMAGE_FILTERS });
      if (!selection) return;
      const paths = (Array.isArray(selection) ? selection : [selection]).filter((path) => !media.some((item) => item.path === path));
      const additions: MediaItem[] = paths.map((path) => ({
        id: makeId(), path, name: fileName(path), kind: "image", durationSeconds: null,
        width: null, height: null, fps: null, sizeBytes: null, formatName: null, status: "ready",
      }));
      setMedia((current) => [...current, ...additions]);
      if (additions[0]) setSelectedMediaId(additions[0].id);
      setNotice(`Added ${additions.length} image(s). Image metadata analysis is not wired yet.`);
    } catch (error) {
      setNotice(`Image import failed: ${String(error)}`);
    }
  }

  function addToTimeline(item: MediaItem) {
    if (item.status !== "ready" || (item.kind !== "video" && item.kind !== "audio")) {
      setNotice("Choose an analyzed video or audio file first.");
      return;
    }
    const duration = item.durationSeconds ?? 5;
    const clip: TimelineClip = {
      id: makeId(), mediaId: item.id, startSeconds: totalDuration,
      sourceInSeconds: 0, sourceOutSeconds: duration,
    };
    setClips((current) => [...current, clip]);
    setSelectedClipId(clip.id);
    setNotice(`Added ${item.name} to the timeline.`);
  }

  function removeMedia(id: string) {
    setMedia((current) => current.filter((item) => item.id !== id));
    setClips((current) => current.filter((clip) => clip.mediaId !== id));
    if (selectedMediaId === id) setSelectedMediaId(null);
    setNotice("Media removed from project. Original file was not deleted.");
  }

  function removeSelectedClip() {
    if (!selectedClipId) return;
    setClips((current) => current.filter((clip) => clip.id !== selectedClipId));
    setSelectedClipId(null);
    setNotice("Timeline clip removed.");
  }

  function createProjectFile(): ProjectFile {
    return { schemaVersion: 1, name: projectName, media, clips, savedAt: new Date().toISOString() };
  }

  async function saveProject() {
    try {
      const path = await save({ defaultPath: `${projectName.replace(/[\\/:*?"<>|]/g, "_")}.pproject`, filters: [{ name: "Proxy Perfect Project", extensions: ["pproject", "json"] }] });
      if (!path) return;
      setBusy(true);
      await invoke("save_project", { path, content: JSON.stringify(createProjectFile(), null, 2) });
      setNotice(`Project saved: ${path}`);
    } catch (error) {
      setNotice(`Save failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loadProject() {
    try {
      const path = await open({ multiple: false, filters: [{ name: "Proxy Perfect Project", extensions: ["pproject", "json"] }] });
      if (!path || Array.isArray(path)) return;
      setBusy(true);
      const content = await invoke<string>("load_project", { path });
      const project = JSON.parse(content) as ProjectFile;
      if (project.schemaVersion !== 1 || !Array.isArray(project.media) || !Array.isArray(project.clips)) {
        throw new Error("Unsupported or invalid project file.");
      }
      setProjectName(project.name || "Untitled Project");
      setMedia(project.media);
      setClips(project.clips);
      setSelectedMediaId(project.media[0]?.id ?? null);
      setSelectedClipId(null);
      setNotice(`Opened project: ${project.name}`);
    } catch (error) {
      setNotice(`Open failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">P</div><div><strong>PROXY PERFECT</strong><span>VIDEO WORKSPACE</span></div></div>
        <div className="project-title"><input aria-label="Project name" value={projectName} onChange={(event) => setProjectName(event.target.value)} /><span>PROJECT</span></div>
        <div className="top-actions"><button onClick={loadProject} disabled={busy}>Open Project</button><button className="primary" onClick={saveProject} disabled={busy}>Save Project</button></div>
      </header>

      <nav className="toolbar"><span className="toolbar-label">MEDIA</span><button onClick={importMedia} disabled={busy}>＋ Import Media</button><button onClick={importImages} disabled={busy}>＋ Import Images</button><div className="toolbar-spacer" /><span className="status-dot" /> <span className="status-text">{busy ? "WORKING" : "LOCAL WORKSPACE"}</span></nav>

      <section className="workspace">
        <aside className="panel media-panel">
          <div className="panel-heading"><div><span className="eyebrow">PROJECT</span><h2>Media Bin</h2></div><span className="count-pill">{media.length}</span></div>
          <div className="media-columns"><span>NAME</span><span>TYPE</span><span>DURATION</span></div>
          <div className="media-list">
            {media.length === 0 ? <div className="empty-state"><div className="empty-icon">＋</div><strong>No media yet</strong><p>Import video or audio to begin.</p><button onClick={importMedia}>Import files</button></div> : media.map((item) => (
              <button key={item.id} className={`media-row ${selectedMediaId === item.id ? "selected" : ""}`} onClick={() => { setSelectedMediaId(item.id); setSelectedClipId(null); }} title={item.path}>
                <span className={`file-icon ${item.kind}`}>{item.kind === "video" ? "▶" : item.kind === "audio" ? "♫" : item.kind === "image" ? "▧" : "·"}</span>
                <span className="media-name"><strong>{item.name}</strong><small>{item.status === "loading" ? "Analyzing metadata…" : item.status === "error" ? "Metadata unavailable" : item.path}</small></span>
                <span className="media-type">{item.kind.toUpperCase()}</span>
                <span className="media-duration">{formatTime(item.durationSeconds)}</span>
              </button>
            ))}
          </div>
          {selectedMedia && <div className="metadata-card"><div className="metadata-title"><strong>Media Properties</strong><button className="icon-button danger" title="Remove media" onClick={() => removeMedia(selectedMedia.id)}>×</button></div><dl>
            <div><dt>Resolution</dt><dd>{selectedMedia.width && selectedMedia.height ? `${selectedMedia.width} × ${selectedMedia.height}` : "—"}</dd></div>
            <div><dt>Frame rate</dt><dd>{formatFps(selectedMedia.fps)}</dd></div>
            <div><dt>Duration</dt><dd>{formatTime(selectedMedia.durationSeconds)}</dd></div>
            <div><dt>File size</dt><dd>{formatBytes(selectedMedia.sizeBytes)}</dd></div>
            <div><dt>Container</dt><dd>{selectedMedia.formatName ?? "—"}</dd></div>
            {selectedMedia.error && <div className="error-text">{selectedMedia.error}</div>}
          </dl><button className="full-button" onClick={() => addToTimeline(selectedMedia)}>Add to Timeline →</button></div>}
        </aside>

        <section className="center-column">
          <div className="panel viewer-panel"><div className="panel-heading compact"><div><span className="eyebrow">MONITOR</span><h2>Preview</h2></div><span className="muted">{selectedClip ? "TIMELINE CLIP" : "SOURCE"}</span></div><div className="viewer"><div className="viewer-frame preview-frame">{!previewUrl ? <><div className="viewer-logo">P<span>▶</span></div><strong>{previewMedia?.name ?? "No media selected"}</strong><p>Import a supported video, audio, or image file to preview it.</p></> : previewMedia?.kind === "image" ? <img className="preview-image" src={previewUrl} alt={previewMedia.name} /> : previewMedia?.kind === "audio" ? <div className="audio-preview"><div className="viewer-logo">♫</div><strong>{previewMedia.name}</strong><p>Audio preview</p><audio ref={audioRef} src={previewUrl} preload="metadata" onLoadedMetadata={(event) => setPreviewDuration(event.currentTarget.duration || 0)} onTimeUpdate={(event) => setPreviewTime(event.currentTarget.currentTime)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} /></div> : <video key={previewUrl} ref={videoRef} className="preview-video" src={previewUrl} preload="metadata" playsInline onLoadedMetadata={(event) => { setPreviewDuration(event.currentTarget.duration || previewMedia?.durationSeconds || 0); setPreviewTime(event.currentTarget.currentTime); }} onTimeUpdate={(event) => setPreviewTime(event.currentTarget.currentTime)} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onError={() => setNotice("This video format or codec could not be played by the preview engine. Try MP4 (H.264/AAC).")}/>}</div></div><div className="preview-seek"><input aria-label="Preview position" type="range" min={0} max={Math.max(0.01, previewDuration)} step="0.01" value={Math.min(previewTime, previewDuration || 0)} onChange={(event) => seekPreview(Number(event.target.value))} disabled={!previewUrl || previewMedia?.kind === "image" || !previewDuration} /></div><div className="viewer-controls"><span className="timecode">{formatTime(previewTime)}</span><div className="transport"><button onClick={() => stepFrame(-1)} disabled={previewMedia?.kind !== "video"}>◀|</button><button className="play-button" onClick={togglePlayback} disabled={!previewUrl || previewMedia?.kind === "image"}>{isPlaying ? "Ⅱ" : "▶"}</button><button onClick={() => stepFrame(1)} disabled={previewMedia?.kind !== "video"}>|▶</button></div><span className="muted">{previewDuration ? formatTime(previewDuration) : "READY"}</span></div></div>
          <div className="panel inspector-panel"><div className="panel-heading compact"><div><span className="eyebrow">INSPECTOR</span><h2>Selection</h2></div></div>{selectedMedia ? <div className="inspector-content"><div><span className="inspector-label">FILE</span><strong>{selectedMedia.name}</strong></div><div><span className="inspector-label">PATH</span><code>{selectedMedia.path}</code></div><div><span className="inspector-label">STATUS</span><strong className={selectedMedia.status === "error" ? "error-text" : "ready-text"}>{selectedMedia.status.toUpperCase()}</strong></div></div> : <div className="subtle-empty">Select a media item to inspect its properties.</div>}</div>
        </section>

        <section className="panel timeline-panel"><div className="panel-heading"><div><span className="eyebrow">SEQUENCE 01</span><h2>Timeline</h2></div><div className="timeline-actions"><span className="muted">{formatTime(totalDuration)} total</span><button onClick={removeSelectedClip} disabled={!selectedClipId}>Remove Clip</button></div></div><div className="timeline-ruler"><span>00:00</span><span>00:10</span><span>00:20</span><span>00:30</span><span>00:40</span></div><div className="timeline-track"><div className="track-label">V1</div><div className="track-lane">{clips.filter((clip) => media.find((item) => item.id === clip.mediaId)?.kind === "video").map((clip) => {
          const item = media.find((entry) => entry.id === clip.mediaId);
          const duration = Math.max(1, clip.sourceOutSeconds - clip.sourceInSeconds);
          return <button key={clip.id} className={`timeline-clip video-clip ${selectedClipId === clip.id ? "active" : ""}`} style={{ left: `${(clip.startSeconds / timelineScale) * 100}%`, width: `${Math.max(7, (duration / timelineScale) * 100)}%` }} onClick={() => setSelectedClipId(clip.id)} title={item?.name}>{item?.name ?? "Missing media"}<small>{formatTime(duration)}</small></button>;
        })}</div></div><div className="timeline-track"><div className="track-label">A1</div><div className="track-lane audio-lane">{clips.filter((clip) => media.find((item) => item.id === clip.mediaId)?.kind === "audio").map((clip) => {
          const item = media.find((entry) => entry.id === clip.mediaId);
          const duration = Math.max(1, clip.sourceOutSeconds - clip.sourceInSeconds);
          return <button key={clip.id} className={`timeline-clip audio-clip ${selectedClipId === clip.id ? "active" : ""}`} style={{ left: `${(clip.startSeconds / timelineScale) * 100}%`, width: `${Math.max(7, (duration / timelineScale) * 100)}%` }} onClick={() => setSelectedClipId(clip.id)} title={item?.name}>{item?.name ?? "Missing media"}<small>{formatTime(duration)}</small></button>;
        })}</div></div>{clips.length === 0 && <div className="timeline-empty">Your timeline is empty. Select a video or audio file and choose <strong>Add to Timeline</strong>.</div>}<div className="timeline-footer"><span>{clips.length} clip(s)</span><span>Drag editing and playback are not implemented yet</span></div></section>
      </section>
      <footer className="statusbar"><span><span className="status-dot" /> {notice}</span><span>PROXY PERFECT · EARLY BUILD</span></footer>
    </main>
  );
}
