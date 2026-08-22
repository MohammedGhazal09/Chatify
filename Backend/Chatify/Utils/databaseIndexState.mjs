const DEFAULT_STATE = Object.freeze({
  status: 'unknown',
  checkedAt: null,
  checked: 0,
  missing: [],
  mismatched: [],
});

let state = { ...DEFAULT_STATE };

export const getDatabaseIndexState = () => ({
  ...state,
  missing: [...state.missing],
  mismatched: [...state.mismatched],
});

export const setDatabaseIndexState = (nextState = {}) => {
  state = {
    ...DEFAULT_STATE,
    ...nextState,
    missing: [...(nextState.missing ?? [])],
    mismatched: [...(nextState.mismatched ?? [])],
  };

  return getDatabaseIndexState();
};

export const resetDatabaseIndexStateForTests = () => {
  state = { ...DEFAULT_STATE };
};
