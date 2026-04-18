import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { jobs as jobsApi } from "@/api/backend";

interface JobState {
  list: unknown[];
  selected: unknown | null;
  loading: boolean;
  error: string | null;
}

export const fetchJobs  = createAsyncThunk("jobs/fetchAll", () => jobsApi.list());
export const fetchJob   = createAsyncThunk("jobs/fetchOne", (id: string) => jobsApi.get(id));
export const createJob  = createAsyncThunk("jobs/create",  (data: unknown) => jobsApi.create(data));
export const updateJob  = createAsyncThunk("jobs/update",  ({ id, data }: { id: string; data: unknown }) => jobsApi.update(id, data));
export const deleteJob  = createAsyncThunk("jobs/delete",  (id: string) => jobsApi.delete(id).then(() => id));

const jobsSlice = createSlice({
  name: "jobs",
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
  } as JobState,
  reducers: {
    clearSelected: (state) => { state.selected = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetchJobs — backend now returns a plain array
      .addCase(fetchJobs.pending,   (state)         => { state.loading = true; state.error = null; })
      .addCase(fetchJobs.fulfilled, (state, action) => {
        state.loading = false;
        state.list = Array.isArray(action.payload) ? action.payload as unknown[] : [];
      })
      .addCase(fetchJobs.rejected,  (state, action) => { state.loading = false; state.error = action.error.message ?? null; })

      // fetchJob — backend returns a plain job object
      .addCase(fetchJob.fulfilled,  (state, action) => { state.selected = action.payload; })

      // createJob — backend returns the new job directly
      .addCase(createJob.fulfilled, (state, action) => {
        (state.list as unknown[]).unshift(action.payload);
      })

      // updateJob — backend returns the updated job directly
      .addCase(updateJob.fulfilled, (state, action) => {
        const payload = action.payload as { id: string };
        const idx = (state.list as { id: string }[]).findIndex(j => j.id === payload.id);
        if (idx !== -1) (state.list as unknown[])[idx] = payload;
        if ((state.selected as { id: string } | null)?.id === payload.id) state.selected = payload;
      })

      // deleteJob — we passed back the id ourselves
      .addCase(deleteJob.fulfilled, (state, action) => {
        state.list = (state.list as { id: string }[]).filter(j => j.id !== action.payload);
        if ((state.selected as { id: string } | null)?.id === action.payload) state.selected = null;
      });
  },
});

export const { clearSelected } = jobsSlice.actions;
export default jobsSlice.reducer;
