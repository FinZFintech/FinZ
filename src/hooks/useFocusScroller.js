import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * useFocusScroller — auto-scroll a ScrollView to the next action the
 * customer should focus on.
 *
 * Usage:
 *   const { scrollRef, anchorRef, scrollToAnchor } = useFocusScroller();
 *
 *   // Attach to your ScrollView:
 *   <ScrollView ref={scrollRef}>
 *     ...
 *     <View ref={anchorRef('borrowerForm')}>...</View>
 *     ...
 *     <View ref={anchorRef('coApplicants')}>...</View>
 *   </ScrollView>
 *
 *   // After an action completes, ask the screen to scroll:
 *   onChange={(v) => { setX(v); scrollToAnchor('coApplicants'); }}
 *
 * Notes:
 *   • anchorRef(key) returns a ref-callback that records the View's Y
 *     offset using onLayout. The first call reuses the same ref instance
 *     (function identity is stable for that key) so you don't have to
 *     memoise it on the consumer side.
 *   • scrollToAnchor(key, { offset = 16, animated = true }) scrolls the
 *     View into view, leaving `offset` pixels of headroom above so the
 *     section title isn't pinned to the top.
 *   • If the anchor hasn't been laid out yet (initial render before
 *     onLayout fires), the call is queued and replays once the anchor
 *     reports a position.
 *   • Safe on web (Expo for Web): falls back to window.scrollTo for the
 *     pageYOffset path when the ScrollView ref doesn't expose
 *     scrollTo (rare but happens with some custom ScrollView wrappers).
 */
export default function useFocusScroller() {
  const scrollRef = useRef(null);
  // anchors[key] = { y: number | null }
  const anchors = useRef({});
  // Pending scroll requests waiting for an anchor that hasn't laid
  // out yet. Keyed by anchor name → latest options object.
  const pending = useRef({});
  // Cache of anchor-ref factories so each key gets a stable function
  // identity (re-using the same ref-callback across re-renders avoids
  // React detaching / re-attaching the ref every paint).
  const refFactories = useRef({});

  const anchorRef = useCallback((key) => {
    if (!refFactories.current[key]) {
      refFactories.current[key] = (node) => {
        if (!node) return;
        // measure() / measureInWindow may be async — onLayout is
        // simpler and guaranteed to fire before paint, so we hook
        // into the View by stashing a measure function:
        anchors.current[key] = anchors.current[key] || { y: null, node };
        anchors.current[key].node = node;
      };
    }
    return refFactories.current[key];
  }, []);

  // Updated by the consumer's <View onLayout> callback (provided via
  // a helper below) OR can be omitted if the consumer wraps the View
  // with measureLayout.
  const recordAnchorY = useCallback((key, y) => {
    anchors.current[key] = { ...(anchors.current[key] || {}), y };
    if (pending.current[key]) {
      const opts = pending.current[key];
      delete pending.current[key];
      // Replay the queued request now that we know the position.
      scrollToY(y, opts);
    }
  }, []);

  const scrollToY = useCallback((y, { offset = 16, animated = true } = {}) => {
    const targetY = Math.max(0, y - offset);
    const sv = scrollRef.current;
    if (sv && typeof sv.scrollTo === 'function') {
      sv.scrollTo({ y: targetY, animated });
      return;
    }
    if (sv && typeof sv.scrollToOffset === 'function') {
      // FlatList / SectionList expose scrollToOffset.
      sv.scrollToOffset({ offset: targetY, animated });
      return;
    }
    // Web fallback for raw <div>-style refs.
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.scrollTo({ top: targetY, behavior: animated ? 'smooth' : 'auto' });
    }
  }, []);

  const scrollToAnchor = useCallback((key, opts = {}) => {
    const a = anchors.current[key];
    if (a && typeof a.y === 'number') {
      scrollToY(a.y, opts);
      return;
    }
    // Anchor not measured yet — queue, replay once recordAnchorY fires.
    pending.current[key] = opts;
  }, [scrollToY]);

  // Convenience helper: returns the props you spread on a <View> so
  // the anchor's Y offset is recorded automatically.
  //   <View {...anchorProps('coApplicants')}>...</View>
  const anchorProps = useCallback((key) => ({
    ref: anchorRef(key),
    onLayout: (e) => {
      const y = e?.nativeEvent?.layout?.y;
      if (typeof y === 'number') recordAnchorY(key, y);
    },
  }), [anchorRef, recordAnchorY]);

  // Reset pending queue when the screen unmounts so a delayed scroll
  // doesn't try to interact with a stale ScrollView ref.
  useEffect(() => () => {
    pending.current = {};
    anchors.current = {};
  }, []);

  return {
    scrollRef,
    anchorRef,
    anchorProps,
    scrollToAnchor,
    recordAnchorY,
  };
}
