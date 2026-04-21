import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer       from "./authSlice";
import jobsReducer       from "./jobSlice";
import applicantsReducer from "./applicantsSlice";
import resultsReducer    from "./resultsSlice";

const appReducer = combineReducers({
  auth:       authReducer,
  jobs:       jobsReducer,
  applicants: applicantsReducer,
  results:    resultsReducer,
});

// Root reducer — handles RESET_ALL by wiping all slices back to initialState
const rootReducer = (state: any, action: any) => {
  if (action.type === "RESET_ALL") {
    state = undefined;
  }
  return appReducer(state, action);
};

export const store = configureStore({
  reducer: rootReducer,
});

export type RootState   = ReturnType<typeof appReducer>;
export type AppDispatch = typeof store.dispatch;