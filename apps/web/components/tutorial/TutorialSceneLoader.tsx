import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { loadTutorialDeferredSlide } from "./tutorial-deferred";

type Scene = Awaited<ReturnType<typeof loadTutorialDeferredSlide>>;

export function TutorialSceneLoader({ reservedHeight, onRetryFocus, ...props }: Parameters<Scene>[0] & {
  reservedHeight: number;
  onRetryFocus: () => void;
}) {
  const [Content, setContent] = useState<Scene | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed) return;
    let active = true;
    void loadTutorialDeferredSlide().then(
      (Scene) => { if (active) setContent(() => Scene); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [failed]);

  if (Content) return <Content {...props} />;

  return (
    <div className="tutorial-slide tutorial-scene-loading"
      style={reservedHeight > 0 ? { minHeight: reservedHeight } : undefined}>
      <p role={failed ? "alert" : "status"} aria-atomic="true">
        {failed ? "Сцената не се зареди." : "Зареждаме сцената..."}
      </p>
      {failed ? <div className="tutorial-scene-recovery">
        <button type="button" className="btn btn-primary" onClick={() => {
          onRetryFocus();
          setFailed(false);
        }}><RotateCw size={18} aria-hidden="true" /> Опитай отново</button>
        <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
          <RotateCw size={18} aria-hidden="true" /> Презареди страницата
        </button>
      </div> : null}
    </div>
  );
}
