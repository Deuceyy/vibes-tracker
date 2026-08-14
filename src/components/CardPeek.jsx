import { useEffect, useRef, useState } from 'react';

// Selector for every card thumbnail on the site that should get a
// hover-zoom preview. The preview shows the same image large, floating
// beside the cursor.
const PEEK_SELECTOR = [
  'img.card-image',
  'img.deck-card-thumb',
  'img.deck-image-thumb',
  'img.mulligan-card-image',
  '.proxy-picker-image img',
  '.pt-card img',
].join(', ');

const PEEK_WIDTH = 320;
const PEEK_HEIGHT = 448; // 5:7 card ratio
const CURSOR_GAP = 24;

export default function CardPeek() {
  const [peek, setPeek] = useState(null); // { src, x, y }
  const rafRef = useRef(0);

  useEffect(() => {
    // Hover previews only make sense with a real pointer.
    if (!window.matchMedia('(hover: hover)').matches) return undefined;

    const position = (event) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Prefer right of cursor; flip left near the right edge.
      let x = event.clientX + CURSOR_GAP;
      if (x + PEEK_WIDTH > vw - 8) x = event.clientX - CURSOR_GAP - PEEK_WIDTH;
      let y = event.clientY - PEEK_HEIGHT / 2;
      y = Math.max(8, Math.min(y, vh - PEEK_HEIGHT - 8));
      return { x, y };
    };

    const onOver = (event) => {
      const img = event.target.closest?.(PEEK_SELECTOR);
      if (!img || !img.src) return;
      const { x, y } = position(event);
      setPeek({ src: img.src, x, y });
    };

    const onMove = (event) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setPeek((prev) => {
          if (!prev) return prev;
          const { x, y } = position(event);
          return { ...prev, x, y };
        });
      });
    };

    const onOut = (event) => {
      const img = event.target.closest?.(PEEK_SELECTOR);
      if (!img) return;
      // Only hide if we actually left the thumbnail (not moving between
      // its children).
      if (event.relatedTarget && img.contains(event.relatedTarget)) return;
      setPeek(null);
    };

    const onHide = () => setPeek(null);

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('scroll', onHide, true);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('scroll', onHide, true);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!peek) return null;

  return (
    <div
      className="card-peek"
      style={{ left: peek.x, top: peek.y, width: PEEK_WIDTH, height: PEEK_HEIGHT }}
    >
      <img src={peek.src} alt="" />
    </div>
  );
}
