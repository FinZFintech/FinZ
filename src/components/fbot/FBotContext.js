import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const FBotContext = createContext(null);

/**
 * FBot Action Bridge
 *
 * Shared context between FBot chat and loan form screens.
 * When FBot collects data from the user via chat, it posts an
 * action here. The active loan screen listens for actions and
 * fills its form fields + triggers button presses accordingly.
 *
 * Actions: { type, value, timestamp }
 */
export const FBotProvider = ({ children }) => {
  const [lastAction, setLastAction] = useState(null);
  const listenersRef = useRef({});

  const postAction = useCallback((action) => {
    const enriched = { ...action, timestamp: Date.now() };
    setLastAction(enriched);
    console.log('[FBot] Action:', enriched.type, enriched.value || '');
    // Notify all registered listeners
    Object.values(listenersRef.current).forEach((fn) => {
      try { fn(enriched); } catch (e) { console.log('[FBot] Listener error:', e?.message); }
    });
  }, []);

  const registerListener = useCallback((id, callback) => {
    listenersRef.current[id] = callback;
    return () => { delete listenersRef.current[id]; };
  }, []);

  return (
    <FBotContext.Provider value={{ lastAction, postAction, registerListener }}>
      {children}
    </FBotContext.Provider>
  );
};

export const useFBot = () => {
  const ctx = useContext(FBotContext);
  if (!ctx) return { lastAction: null, postAction: () => {}, registerListener: () => () => {} };
  return ctx;
};
