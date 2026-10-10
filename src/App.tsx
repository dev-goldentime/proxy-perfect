
import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles.css";

type MediaFile = {
  path: string;
  name: string;
  type: "video" | "audio" | "image" | "other";
};

function getMediaType(name: string): MediaFile["type"] {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";

  if (["mp4", "mov", "mkv", "webm", "avi", "m4v"].includes(ext)) {
    return "video";
  }

  if (["mp3", "wav", "ogg", "flac", "m4a", "aac"].includes(ext)) {
    return "audio";
  }

  if (["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) {
    return "image";
  }

  return "other";
}

function App() {
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [error, setError] = useState("");

  async function importMedia() {
    setError("");

    try {
      const selected = await open({
        multiple: true,
        directory: false,
        title: "미디어 파일 불러오기",
        filters: [
          {
            name: "미디어 파일",
            extensions: [
              "mp4", "mov", "mkv", "webm", "avi", "m4v",
              "mp3", "wav", "ogg", "flac", "m4a", "aac",
              "png", "jpg", "jpeg", "webp", "gif", "bmp",
            ],
          },
        ],
      });

      if (!selected) return;

      const paths = Array.isArray(selected) ? selected : [selected];

      setMedia((previous) => {
        const existingPaths = new Set(previous.map((item) => item.path));

        const additions = paths
          .filter((path) => !existingPaths.has(path))
          .map((path): MediaFile => {
            const name = path.split(/[\\/]/).pop() ?? path;

            return {
              path,
              name,
              type: getMediaType(name),
            };
          });

        return [...previous, ...additions];
      });
    } catch (e) {
      setError(`파일을 불러오지 못했습니다: ${String(e)}`);
    }
  }

  function removeMedia(path: string) {
    setMedia((previous) => previous.filter((item) => item.path !== path));
  }

  return (
    <main className="editor">
      <header className="topbar">
        <strong>PROXY PERFECT</strong>
        <span>새 프로젝트</span>
      </header>

      <section className="workspace">
        <aside className="media-panel">
          <div className="panel-heading">
            <span>미디어 ({media.length})</span>
            <button onClick={importMedia}>+ 불러오기</button>
          </div>

          {error && <p role="alert">{error}</p>}

          {media.length === 0 ? (
            <div className="media-empty">
              <p>불러온 파일이 없습니다.</p>
              <button onClick={importMedia}>파일 선택</button>
            </div>
          ) : (
            <ul className="media-list">
              {media.map((item) => (
                <li key={item.path} className="media-item">
                  <div>
                    <strong>{item.name}</strong>
                    <small>{item.type.toUpperCase()}</small>
                  </div>
                  <button
                    aria-label={`${item.name} 제거`}
                    onClick={() => removeMedia(item.path)}
                  >
                    제거
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="preview-panel">
          <div className="panel-heading">미리보기</div>
          <div className="preview-screen">
            {media.length > 0
              ? `${media.length}개 파일을 불러왔습니다.`
              : "아직 선택한 미디어가 없습니다."}
          </div>
        </section>
      </section>

      <section className="timeline-panel">
        <div className="panel-heading">타임라인</div>
        <p>다음 단계에서 클립 편집 기능을 구현합니다.</p>
      </section>
    </main>
  );
}

export default App;
