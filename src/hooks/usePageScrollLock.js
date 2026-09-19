import { useLayoutEffect } from 'react';

export default function usePageScrollLock(locked) {
  useLayoutEffect(() => {
    if (!locked) return;

    const { body, documentElement } = document;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const properties = ['position', 'top', 'left', 'width', 'overflow', 'paddingRight'];
    const previousBodyStyles = Object.fromEntries(properties.map((property) => [property, body.style[property]]));
    const previousRootOverflow = documentElement.style.overflow;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const paddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    // Fix the body in place as well as hiding overflow: mobile Safari can
    // otherwise keep scrolling the page behind a fixed overlay.
    documentElement.style.overflow = 'hidden';
    Object.assign(body.style, {
      position: 'fixed',
      top: `${-scrollY}px`,
      left: `${-scrollX}px`,
      width: '100%',
      overflow: 'hidden',
      paddingRight: `${paddingRight + scrollbarWidth}px`,
    });

    return () => {
      Object.assign(body.style, previousBodyStyles);
      documentElement.style.overflow = previousRootOverflow;
      // Override the site's smooth scrolling while restoring the saved position.
      window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    };
  }, [locked]);
}
