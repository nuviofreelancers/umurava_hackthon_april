import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { applicants as applicantsApi } from "@/api/backend";

interface ApplicantsState {
  list: unknown[];
  selected: unknown | null;
  loading: boolean;
  error: string | null;
}

export const fetchApplicants      = createAsyncThunk("applicants/fetchAll", () => applicantsApi.list());
export const fetchApplicantsByJob = createAsyncThunk("applicants/byJob",    (jobId: string) => applicantsApi.listByJob(jobId));
export const fetchApplicant       = createAsyncThunk("applicants/fetchOne", (id: string) => applicantsApi.get(id));
export const createApplicant      = createAsyncThunk("applicants/create",   (data: unknown) => applicantsApi.create(data));
export const bulkCreateApplicants = createAsyncThunk(
  "applicants/bulk",
  ({ data, jobId, sourceType }: { data: unknown[]; jobId?: string; sourceType?: string }) =>
    applicantsApi.bulkCreate(data, jobId, sourceType)
);
export const updateApplicant = createAsyncThunk("applicants/update", ({ id, data }: { id: string; data: unknown }) => applicantsApi.update(id, data));
export const deleteApplicant = createAsyncThunk("applicants/delete", (id: string) => applicantsApi.delete(id).then(() => id));

const applicantsSlice = createSlice({
  name: "applicants",
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
  } as ApplicantsState,
  reducers: {
    clearApplicants: (state) => { state.list = []; },
  },
  extraReducers: (builder) => {
    builder
      // fetchAll & byJob — backend returns plain arrays
      .addCase(fetchApplicants.pending,        (state)         => { state.loading = true; state.error = null; })
      .addCase(fetchApplicants.fulfilled,      (state, action) => {
        state.loading = false;
        state.list = Array.isArray(action.payload) ? action.payload as unknown[] : [];
      })
      .addCase(fetchApplicants.rejected,       (state, action) => { state.loading = false; state.error = action.error.message ?? null; })
      .addCase(fetchApplicantsByJob.pending,   (state)         => { state.loading = true; state.error = null; })
      .addCase(fetchApplicantsByJob.fulfilled, (state, action) => {
        state.loading = false;
        state.list = Array.isArray(action.payload) ? action.payload as unknown[] : [];
      })
      .addCase(fetchApplicantsByJob.rejected,  (state, action) => { state.loading = false; state.error = action.error.message ?? null; })

      // fetchOne — backend returns plain object
      .addCase(fetchApplicant.fulfilled, (state, action) => { state.selected = action.payload; })

      // createApplicant — backend returns the new applicant directly
      .addCase(createApplicant.fulfilled, (state, action) => {
        (state.list as unknown[]).unshift(action.payload);
      })

      // bulkCreate — backend returns plain array of inserted docs
      .addCase(bulkCreateApplicants.fulfilled, (state, action) => {
        const inserted = Array.isArray(action.payload) ? action.payload as unknown[] : [];
        state.list = [...inserted, ...state.list];
      })

      // updateApplicant — backend returns updated doc directly
      .addCase(updateApplicant.fulfilled, (state, action) => {
        const payload = action.payload as { id: string };
        const idx = (state.list as { id: string }[]).findIndex(a => a.id === payload.id);
        if (idx !== -1) (state.list as unknown[])[idx] = payload;
        if ((state.selected as { id: string } | null)?.id === payload.id) state.selected = payload;
      })

      // deleteApplicant — we return the id ourselves
      .addCase(deleteApplicant.fulfilled, (state, action) => {
        state.list = (state.list as { id: string }[]).filter(a => a.id !== action.payload);
      });
  },
});

export const { clearApplicants } = applicantsSlice.actions;
export default applicantsSlice.reducer;
