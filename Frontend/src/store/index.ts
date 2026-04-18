import { configureStore } from "@reduxjs/toolkit";
import authReducer       from "./authSlice";
import jobsReducer       from "./jobSlice";
import applicantsReducer from "./applicantsSlice";
import resultsReducer    from "./resultsSlice";

export const store = configureStore({
  reducer: {
    auth:       authReducer,
    jobs:       jobsReducer,
    applicants: applicantsReducer,
    results:    resultsReducer,
  },
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
