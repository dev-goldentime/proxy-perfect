
import "./App.css";

function App() {
  return (
    <main className="editor">
      <header className="topbar">
        <div className="brand">
          <span className="brand-icon">P</span>
          <span>PROXY PERFECT</span>
        </div>

        <div className="project-name">새 프로젝트</div>

        <button className="export-button">내보내기</button>
      </header>

      <section className="workspace">
        <aside className="media-panel">
          <div className="panel-heading">
            <span>미디어</span>
            <button className="small-button">+</button>
          </div>

          <div className="media-empty">
            <span className="large-icon">▧</span>
            <p>미디어가 없습니다</p>
            <span>영상과 오디오를 불러올 수 있어요.</span>
          </div>
        </aside>

        <section className="preview-panel">
          <div className="panel-heading">
            <span>미리보기</span>
            <span className="muted">미리보기 준비 중</span>
          </div>

          <div className="preview-screen">
            <div className="preview-mark">P</div>
            <p>PROXY PERFECT</p>
            <span>영상 미리보기 영역</span>
          </div>

          <div className="preview-controls">
            <span>00:00:00:00</span>
            <button className="play-button" disabled>▶</button>
            <span>00:00:00:00</span>
          </div>
        </section>
      </section>

      <section className="timeline-panel">
        <div className="timeline-toolbar">
          <span>타임라인</span>
          <div className="timeline-tools">
            <button className="small-button" disabled>−</button>
            <span>100%</span>
            <button className="small-button" disabled>+</button>
          </div>
        </div>

        <div className="timeline-ruler">
          <span>00:00</span>
          <span>00:10</span>
          <span>00:20</span>
          <span>00:30</span>
          <span>00:40</span>
          <span>00:50</span>
        </div>

        <div className="track">
          <div className="track-label">V1</div>
          <div className="track-content">영상을 여기에 배치</div>
        </div>

        <div className="track">
          <div className="track-label">A1</div>
          <div className="track-content">오디오를 여기에 배치</div>
        </div>

        <div className="timeline-footer">
          클립 0개 · 프로젝트 준비 완료
        </div>
      </section>

      <footer className="statusbar">
        <span>준비됨</span>
        <span>Proxy Perfect · 초기 버전</span>
      </footer>
    </main>
  );
}

export default App;