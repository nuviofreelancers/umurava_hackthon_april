import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { results as resultsApi, screening } from "@/api/backend";

export const fetchResults             = createAsyncThunk("results/fetchAll",          () => resultsApi.list());
export const fetchResultsByJob        = createAsyncThunk("results/byJob",             (jobId) => resultsApi.listByJob(jobId));
export const runScreening             = createAsyncThunk("results/screen",            ({ jobId, weights }) => screening.run(jobId, weights));
export const deleteResultsByJob       = createAsyncThunk("results/deleteByJob",       (jobId) => resultsApi.deleteByJob(jobId).then(() => jobId));
export const deleteResultsByApplicant = createAsyncThunk("results/deleteByApplicant", (applicantId) => resultsApi.deleteByApplicant(applicantId).then(() => applicantId));

const resultsSlice = createSlice({
  name: "results",
  initialState: {
    list:      [],
    screening: false,
    progress:  0,
    error:     null,
  },
  reducers: {
    setScreeningProgress: (state, action) => { state.progress = action.payload; },
    resetScreening: (state) => { state.screening = false; state.progress = 0; state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchResults.fulfilled,              (state, action) => { state.list = action.payload; })
      .addCase(fetchResultsByJob.fulfilled,         (state, action) => {
        state.list = action.payload;
        // Reset stale progress whenever we load fresh results for a job
        if (state.progress === 100) { state.progress = 0; }
      })
      .addCase(runScreening.pending,                (state) => { state.screening = true; state.progress = 20; state.error = null; })
      .addCase(runScreening.fulfilled,              (state, action) => {
        state.screening = false;
        state.progress  = 100;
        state.list      = action.payload.results || [];
      })
      .addCase(runScreening.rejected,               (state, action) => {
        state.screening = false;
        state.progress  = 0;
        state.error     = action.error.message;
      })
      .addCase(deleteResultsByJob.fulfilled,        (state, action) => {
        state.list = state.list.filter(r => r.job_id !== action.payload);
      })
      .addCase(deleteResultsByApplicant.fulfilled,  (state, action) => {
        state.list = state.list.filter(r => r.applicant_id !== action.payload);
      });
  },
});

export const { setScreeningProgress, resetScreening } = resultsSlice.actions;
export default resultsSlice.reducer;
