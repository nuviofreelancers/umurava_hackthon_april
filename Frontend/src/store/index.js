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
