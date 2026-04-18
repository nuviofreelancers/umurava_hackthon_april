import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { results as resultsApi, screening } from "@/api/backend";

interface ResultsState {
  list: unknown[];
  screening: boolean;
  progress: number;
  error: string | null;
}

export const fetchResults             = createAsyncThunk("results/fetchAll", () => resultsApi.list());
export const fetchResultsByJob        = createAsyncThunk("results/byJob",    (jobId: string) => resultsApi.listByJob(jobId));
export const runScreening             = createAsyncThunk(
  "results/screen",
  ({ jobId, weights, shortlistSize }: { jobId: string; weights: Record<string, number>; shortlistSize?: number }) =>
    screening.run(jobId, weights, shortlistSize)
);
export const deleteResultsByJob       = createAsyncThunk("results/deleteByJob",       (jobId: string) => resultsApi.deleteByJob(jobId).then(() => jobId));
export const deleteResultsByApplicant = createAsyncThunk("results/deleteByApplicant", (applicantId: string) => resultsApi.deleteByApplicant(applicantId).then(() => applicantId));

const resultsSlice = createSlice({
  name: "results",
  initialState: {
    list: [],
    screening: false,
    progress: 0,
    error: null,
  } as ResultsState,
  reducers: {
    setScreeningProgress: (state, action) => { state.progress = action.payload as number; },
    resetScreening: (state) => { state.screening = false; state.progress = 0; state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll & byJob — backend returns plain arrays
      .addCase(fetchResults.fulfilled,       (state, action) => {
        state.list = Array.isArray(action.payload) ? action.payload as unknown[] : [];
      })
      .addCase(fetchResultsByJob.fulfilled,  (state, action) => {
        state.list = Array.isArray(action.payload) ? action.payload as unknown[] : [];
        if (state.progress === 100) state.progress = 0;
      })

      // runScreening — backend returns plain array of saved results
      .addCase(runScreening.pending,    (state)         => { state.screening = true; state.progress = 20; state.error = null; })
      .addCase(runScreening.fulfilled,  (state, action) => {
        state.screening = false;
        state.progress  = 100;
        state.list      = Array.isArray(action.payload) ? action.payload as unknown[] : [];
      })
      .addCase(runScreening.rejected,   (state, action) => {
        state.screening = false;
        state.progress  = 0;
        state.error     = action.error.message ?? null;
      })

      // deletes — filter by id
      .addCase(deleteResultsByJob.fulfilled, (state, action) => {
        state.list = (state.list as { job_id: string }[]).filter(r => r.job_id !== action.payload);
      })
      .addCase(deleteResultsByApplicant.fulfilled, (state, action) => {
        state.list = (state.list as { applicant_id: string }[]).filter(r => r.applicant_id !== action.payload);
      });
  },
});

export const { setScreeningProgress, resetScreening } = resultsSlice.actions;
export default resultsSlice.reducer;
