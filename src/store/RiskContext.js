import React, { createContext, useContext, useReducer, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runPhaseA, runPhaseB, runPhaseC, runPhaseD } from '../services/riskEngine';
import { parseBankStatementUpload, parseAccountAggregatorData } from '../services/bankStatementParser';

const RiskContext = createContext(null);

const AUDIT_STORAGE_KEY = 'finz_risk_audit_trail';
const MAX_STORED_PROFILES = 50;

const initialState = {
  currentPhase: null,       // 'A' | 'B' | 'C' | 'D' | 'complete'
  isCalculating: false,
  error: null,

  // Phase results
  phaseResults: {},         // { A: { score, gate, completedAt }, B: ..., etc. }
  apis: {},                 // Accumulated API responses across phases

  // Scoring
  finalScore: null,
  categoryScores: null,
  decision: null,           // { decision, label, reason }
  allFlags: [],
  reasonCodes: [],

  // Audit trail
  riskProfile: null,        // Full risk profile for persistence

  // Degradation tracking
  degradedApis: [],         // APIs that returned fallback due to circuit breaker
};

function riskReducer(state, action) {
  switch (action.type) {
    case 'PHASE_START':
      return { ...state, isCalculating: true, currentPhase: action.payload, error: null };

    case 'PHASE_COMPLETE': {
      const { phase, result } = action.payload;
      const allFlags = [];
      if (result.categoryScores) {
        for (const cat of Object.values(result.categoryScores)) {
          allFlags.push(...cat.flags);
        }
      }

      // Track degraded APIs (circuit breaker fallbacks)
      const degraded = [];
      for (const [key, val] of Object.entries(result.apis || {})) {
        if (val && val._circuitBroken) {
          degraded.push({ api: key, reason: val._fallbackReason });
        }
      }

      return {
        ...state,
        isCalculating: false,
        currentPhase: phase,
        apis: result.apis,
        phaseResults: { ...state.phaseResults, [phase]: { score: result.finalScore, gate: result.gate, completedAt: result.completedAt } },
        finalScore: result.finalScore,
        categoryScores: result.categoryScores,
        decision: result.decision,
        allFlags,
        reasonCodes: allFlags.filter(f => f.type === 'negative').map(f => f.text),
        degradedApis: [...state.degradedApis, ...degraded],
      };
    }

    case 'PHASE_ERROR':
      return { ...state, isCalculating: false, error: action.payload };

    case 'SET_RISK_PROFILE':
      return { ...state, riskProfile: action.payload };

    case 'SET_EXTERNAL_DATA':
      return { ...state, apis: { ...state.apis, ...action.payload } };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ─── Audit Trail Persistence ────────────────────────────────────────────────

async function persistRiskProfile(profile) {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_STORAGE_KEY);
    let history = raw ? JSON.parse(raw) : [];

    // Strip raw API responses for storage efficiency (keep scores + flags + reason codes)
    const compactProfile = {
      applicationId: profile.applicationId,
      finalScore: profile.finalScore,
      decision: profile.decision,
      decisionLabel: profile.decisionLabel,
      reasonCodes: profile.reasonCodes,
      calculatedAt: profile.calculatedAt,
      lastPhase: profile.lastPhase,
      phases: profile.phases,
      categoryScores: profile.categoryScores,
      degradedApis: profile.degradedApis || [],
    };

    history.unshift(compactProfile);
    if (history.length > MAX_STORED_PROFILES) {
      history = history.slice(0, MAX_STORED_PROFILES);
    }

    await AsyncStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage failure should not block the loan flow
  }
}

async function loadAuditTrail() {
  try {
    const raw = await AsyncStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export const RiskProvider = ({ children }) => {
  const [state, dispatch] = useReducer(riskReducer, initialState);

  const executePhase = useCallback(async (phase, applicant) => {
    dispatch({ type: 'PHASE_START', payload: phase });

    try {
      const runners = { A: runPhaseA, B: runPhaseB, C: runPhaseC, D: runPhaseD };
      const runner = runners[phase];
      if (!runner) throw new Error(`Unknown phase: ${phase}`);

      const result = await runner(applicant, state.apis);
      dispatch({ type: 'PHASE_COMPLETE', payload: { phase, result } });

      // Build and persist risk profile after each phase
      const allFlags = [];
      if (result.categoryScores) {
        for (const cat of Object.values(result.categoryScores)) {
          allFlags.push(...cat.flags);
        }
      }
      const profile = {
        applicationId: applicant.applicationId || null,
        finalScore: result.finalScore,
        decision: result.decision?.decision,
        decisionLabel: result.decision?.label,
        reasonCodes: allFlags.filter(f => f.type === 'negative').map(f => f.text),
        calculatedAt: result.completedAt,
        lastPhase: phase,
        phases: { ...state.phaseResults, [phase]: { score: result.finalScore, gate: result.gate, completedAt: result.completedAt } },
        categoryScores: result.categoryScores,
        degradedApis: state.degradedApis,
      };

      dispatch({ type: 'SET_RISK_PROFILE', payload: profile });
      await persistRiskProfile(profile);

      return result;
    } catch (err) {
      dispatch({ type: 'PHASE_ERROR', payload: err.message });
      throw err;
    }
  }, [state.apis, state.phaseResults, state.degradedApis]);

  /**
   * Feed bank statement / AA data into the risk engine.
   * Parses raw income data into the format expected by scoreBankStatement().
   */
  const feedBankStatementData = useCallback((incomeData, source = 'upload') => {
    const parsed = source === 'aa'
      ? parseAccountAggregatorData(incomeData)
      : parseBankStatementUpload(incomeData);

    if (parsed) {
      dispatch({ type: 'SET_EXTERNAL_DATA', payload: { bankStatement: parsed } });
    }
  }, []);

  /**
   * Feed credit bureau data (from soft/hard pull) into the risk engine.
   */
  const feedCreditBureauData = useCallback((creditData) => {
    dispatch({ type: 'SET_EXTERNAL_DATA', payload: { creditBureau: creditData } });
  }, []);

  const setExternalData = useCallback((data) => {
    dispatch({ type: 'SET_EXTERNAL_DATA', payload: data });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const getAuditTrail = useCallback(async () => {
    return loadAuditTrail();
  }, []);

  return (
    <RiskContext.Provider value={{
      state,
      dispatch,
      executePhase,
      feedBankStatementData,
      feedCreditBureauData,
      setExternalData,
      reset,
      getAuditTrail,
    }}>
      {children}
    </RiskContext.Provider>
  );
};

export const useRisk = () => {
  const context = useContext(RiskContext);
  if (!context) throw new Error('useRisk must be used within RiskProvider');
  return context;
};
