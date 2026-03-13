import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { runPhaseA, runPhaseB, runPhaseC, runPhaseD } from '../services/riskEngine';

const RiskContext = createContext(null);

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
      return result;
    } catch (err) {
      dispatch({ type: 'PHASE_ERROR', payload: err.message });
      throw err;
    }
  }, [state.apis]);

  const setExternalData = useCallback((data) => {
    dispatch({ type: 'SET_EXTERNAL_DATA', payload: data });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <RiskContext.Provider value={{ state, dispatch, executePhase, setExternalData, reset }}>
      {children}
    </RiskContext.Provider>
  );
};

export const useRisk = () => {
  const context = useContext(RiskContext);
  if (!context) throw new Error('useRisk must be used within RiskProvider');
  return context;
};
