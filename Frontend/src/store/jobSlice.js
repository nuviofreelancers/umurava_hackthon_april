import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { jobs as jobsApi } from "@/api/backend";

export const fetchJobs    = createAsyncThunk("jobs/fetchAll",  () => jobsApi.list());
export const fetchJob     = createAsyncThunk("jobs/fetchOne",  (id) => jobsApi.get(id));
export const createJob    = createAsyncThunk("jobs/create",    (data) => jobsApi.create(data));
export const updateJob    = createAsyncThunk("jobs/update",    ({ id, data }) => jobsApi.update(id, data));
export const deleteJob    = createAsyncThunk("jobs/delete",    (id) => jobsApi.delete(id).then(() => id));

const jobsSlice = createSlice({
  name: "jobs",
  initialState: {
    list: [],
    selected: null,   // the currently open job in JobDetail
    loading: false,
    error: null,
  },
  reducers: {
    clearSelected: (state) => { state.selected = null; },
  },
  extraReducers: (builder) => {
    builder
      // fetch all
      .addCase(fetchJobs.pending,    (state) => { state.loading = true; })
      .addCase(fetchJobs.fulfilled,  (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchJobs.rejected,   (state, action) => { state.loading = false; state.error = action.error.message; })
      // fetch one
      .addCase(fetchJob.fulfilled,   (state, action) => { state.selected = action.payload; })
      // create
      .addCase(createJob.fulfilled,  (state, action) => { state.list.unshift(action.payload); })
      // update — replace in list and update selected
      .addCase(updateJob.fulfilled,  (state, action) => {
        const idx = state.list.findIndex(j => j.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?.id === action.payload.id) state.selected = action.payload;
      })
      // delete — remove from list
      .addCase(deleteJob.fulfilled,  (state, action) => {
        state.list = state.list.filter(j => j.id !== action.payload);
      });
  },
});

export const { clearSelected } = jobsSlice.actions;
export default jobsSlice.reducer;