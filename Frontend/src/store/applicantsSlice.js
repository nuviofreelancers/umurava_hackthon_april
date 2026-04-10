import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { applicants as applicantsApi } from "@/api/backend";

export const fetchApplicants    = createAsyncThunk("applicants/fetchAll",   () => applicantsApi.list());
export const fetchApplicantsByJob = createAsyncThunk("applicants/byJob",    (jobId) => applicantsApi.listByJob(jobId));
export const fetchApplicant     = createAsyncThunk("applicants/fetchOne",   (id) => applicantsApi.get(id));
export const createApplicant    = createAsyncThunk("applicants/create",     (data) => applicantsApi.create(data));
export const bulkCreateApplicants = createAsyncThunk("applicants/bulk",     (data) => applicantsApi.bulkCreate(data));
export const updateApplicant    = createAsyncThunk("applicants/update",     ({ id, data }) => applicantsApi.update(id, data));
export const deleteApplicant    = createAsyncThunk("applicants/delete",     (id) => applicantsApi.delete(id).then(() => id));

const applicantsSlice = createSlice({
  name: "applicants",
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
  },
  reducers: {
    clearApplicants: (state) => { state.list = []; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApplicants.pending,      (state) => { state.loading = true; })
      .addCase(fetchApplicants.fulfilled,    (state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchApplicantsByJob.fulfilled,(state, action) => { state.loading = false; state.list = action.payload; })
      .addCase(fetchApplicant.fulfilled,     (state, action) => { state.selected = action.payload; })
      .addCase(createApplicant.fulfilled,    (state, action) => { state.list.unshift(action.payload); })
      .addCase(bulkCreateApplicants.fulfilled,(state, action) => {
        state.list = [...(action.payload.applicants || []), ...state.list];
      })
      .addCase(updateApplicant.fulfilled,    (state, action) => {
        const idx = state.list.findIndex(a => a.id === action.payload.id);
        if (idx !== -1) state.list[idx] = action.payload;
        if (state.selected?.id === action.payload.id) state.selected = action.payload;
      })
      .addCase(deleteApplicant.fulfilled,    (state, action) => {
        state.list = state.list.filter(a => a.id !== action.payload);
      });
  },
});

export const { clearApplicants } = applicantsSlice.actions;
export default applicantsSlice.reducer;