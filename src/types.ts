export type MediaKind = "video" | "audio" | "image" | "unknown";

export interface MediaItem {
  id: string;
  path: string;
  name: string;
  kind: MediaKind;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  sizeBytes: number | null;
  formatName: string | null;
  status: "loading" | "ready" | "error";
  error?: string;
}

export interface TimelineClip {
  id: string;
  mediaId: string;
  startSeconds: number;
  sourceInSeconds: number;
  sourceOutSeconds: number;
}

export interface ProjectFile {
  schemaVersion: 1;
  name: string;
  media: MediaItem[];
  clips: TimelineClip[];
  savedAt: string;
}

export interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
}

export interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
    size?: string;
    format_name?: string;
  };
}
