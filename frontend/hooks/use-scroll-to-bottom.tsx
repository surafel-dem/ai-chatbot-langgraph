import useSWR from 'swr';
import { useRef, useEffect, useCallback } from 'react';

type ScrollFlag = ScrollBehavior | false;

export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: isAtBottom = false, mutate: setIsAtBottom } = useSWR(
    'messages:is-at-bottom',
    null,
    { fallbackData: false },
  );

  const { data: scrollBehavior = false, mutate: setScrollBehavior } =
    useSWR<ScrollFlag>('messages:should-scroll', null, { fallbackData: false });

  useEffect(() => {
    if (scrollBehavior) {
      endRef.current?.scrollIntoView({ behavior: scrollBehavior });
      setScrollBehavior(false);
    }
  }, [setScrollBehavior, scrollBehavior]);

  const scrollToBottom = useCallback(
    (scrollBehavior: ScrollBehavior = 'smooth') => {
      setScrollBehavior(scrollBehavior);
    },
    [setScrollBehavior],
  );

  // Streaming-aware scroll: observe new nodes and content growth
  useEffect(() => {
    const container = containerRef.current;
    const end = endRef.current;
    if (!container || !end) return;

    // Scroll immediately on mount
    try {
      end.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    } catch {
      end.scrollIntoView();
    }

    let prevMessageCount = 0;
    let lastMessageLength = 0;

    const observer = new MutationObserver(() => {
      const messages = container.querySelectorAll(
        '[data-role="user"], [data-role="assistant"]',
      );
      const count = messages.length;
      let shouldScroll = false;

      if (count !== prevMessageCount) {
        shouldScroll = true;
        prevMessageCount = count;
      }

      if (count > 0) {
        const last = messages[count - 1];
        const text = last.textContent || '';
        if (text.length > lastMessageLength) {
          shouldScroll = true;
        }
        lastMessageLength = text.length;
      }

      if (shouldScroll) {
        end.scrollIntoView({ behavior: 'smooth' });
      }
    });

    observer.observe(container, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, []);

  function onViewportEnter() {
    setIsAtBottom(true);
  }

  function onViewportLeave() {
    setIsAtBottom(false);
  }

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
  };
}
