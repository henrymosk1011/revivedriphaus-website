import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, SplitText);

const EASE = 'expo.out';

export function playIntro({ reduceMotion }) {
  if (reduceMotion) return;
  const tl = gsap.timeline({ delay: 0.15 });
  tl.from('.hero__title .line > span', { yPercent: 110, duration: 1.5, ease: EASE, stagger: 0.11 })
    .from('.hero [data-reveal]', { opacity: 0, y: 26, duration: 1.2, ease: EASE, stagger: 0.08 }, 0.35)
    .from('.hero__meta > *', { opacity: 0, y: 12, duration: 1, ease: EASE, stagger: 0.06 }, 0.6)
    .from('.nav', { opacity: 0, y: -20, duration: 1.1, ease: EASE }, 0.2);
}

export function initAnimations({ reduceMotion }) {
  if (reduceMotion) return;

  // Fade-up for general copy.
  const reveals = gsap.utils.toArray('[data-reveal]').filter((el) => !el.closest('.hero'));
  gsap.set(reveals, { opacity: 0, y: 34 });
  ScrollTrigger.batch(reveals, {
    start: 'top 88%',
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 1.3, ease: EASE, stagger: 0.08, overwrite: true }),
  });

  // Headlines rise word by word out of a mask.
  gsap.utils.toArray('[data-split]').forEach((el) => {
    const split = SplitText.create(el, { type: 'words,lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
      onSplit(self) {
        return gsap.from(self.words, {
          yPercent: 115,
          duration: 1.4,
          ease: EASE,
          stagger: 0.06,
          scrollTrigger: { trigger: el, start: 'top 82%', once: true },
        });
      },
    });
    el._split = split;
  });

  // About statement lights up word by word as you scroll through it.
  gsap.utils.toArray('[data-scrub-words]').forEach((el) => {
    const split = SplitText.create(el, { type: 'words', wordsClass: 'word' });
    el.classList.add('is-split');
    gsap.fromTo(
      split.words,
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.12,
        scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 42%', scrub: true },
      }
    );
  });

  // The "We come to you" headline holds while the city plays, then dissolves.
  gsap.to('.arrive__sticky', {
    opacity: 0,
    y: -60,
    ease: 'none',
    scrollTrigger: { trigger: '.arrive__lower', start: 'top 98%', end: 'top 50%', scrub: true },
  });

  // Stats and drip cards cascade in.
  ScrollTrigger.batch('.stat', {
    start: 'top 90%',
    onEnter: (batch) => gsap.from(batch, { opacity: 0, y: 40, scale: 0.96, duration: 1.2, ease: EASE, stagger: 0.08 }),
    once: true,
  });
  ScrollTrigger.batch('.drip', {
    start: 'top 92%',
    onEnter: (batch) =>
      gsap.from(batch, { opacity: 0, y: 70, rotateX: -12, transformOrigin: '50% 100%', duration: 1.3, ease: EASE, stagger: 0.07 }),
    once: true,
  });

  // Benefit cards swing in from the side they sit on, drifting with the scroll.
  gsap.utils.toArray('.benefit').forEach((card) => {
    const dir = card.dataset.side === 'right' ? 1 : -1;
    gsap.from(card, {
      opacity: 0,
      x: 80 * dir,
      rotateY: -14 * dir,
      transformPerspective: 1200,
      duration: 1.5,
      ease: EASE,
      scrollTrigger: { trigger: card, start: 'top 85%', once: true },
    });
    gsap.to(card.querySelector('img'), {
      yPercent: -8,
      scale: 1.08,
      ease: 'none',
      scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  gsap.from('.addons', {
    opacity: 0,
    y: 60,
    duration: 1.3,
    ease: EASE,
    scrollTrigger: { trigger: '.addons', start: 'top 90%', once: true },
  });
  for (const sel of ['.faq__list', '.contact .form']) {
    gsap.from(sel, {
      opacity: 0,
      y: 50,
      duration: 1.3,
      ease: EASE,
      scrollTrigger: { trigger: sel, start: 'top 90%', once: true },
    });
  }

  gsap.from('.footer__giant', {
    yPercent: 40,
    opacity: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
}
