import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { applicants as applicantsApi } from "@/api/backend";

// FIX: updated state to track pagination metadata
interface ApplicantsState {
  list: unknown[];
  selected: unknown | null;
  loading: boolean;
  error: string | null;
  // pagination
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

// Helper: extract the data array from either the old plain-array response
// or the new paginated { data, total, page, ... } shape
function extractList(payload: unknown): { list: unknown[]; total: number; page: number; totalPages: number; hasMore: boolean } {
  if (Array.isArray(payload)) {
    return { list: payload, total: payload.length, page: 1, totalPages: 1, hasMore: false };
  }
  const p = payload as any;
  if (p && Array.isArray(p.data)) {
    return { list: p.data, total: p.total ?? p.data.length, page: p.page ?? 1, totalPages: p.totalPages ?? 1, hasMore: p.hasMore ?? false };
  }
  return { list: [], total: 0, page: 1, totalPages: 1, hasMore: false };
}

export const fetchApplicants      = createAsyncThunk("applicants/fetchAll", (args: { page?: number; limit?: number } = {}) =>
  applicantsApi.list(args.page ?? 1, args.limit ?? 50)
);
export const fetchApplicantsByJob = createAsyncThunk("applicants/byJob",    ({ jobId, page = 1, limit = 50 }: { jobId: string; page?: number; limit?: number }) =>
  applicantsApi.listByJob(jobId, page, limit)
);
export const fetchApplicant       = createAsyncThunk("applicants/fetchOne", (id: string) => applicantsApi.get(id));
export const createApplicant      = createAsyncThunk("applicants/create",   (data: unknown) => applicantsApi.create(data));
export const bulkCreateApplicants = createAsyncThunk(
  "applicants/bulk",
  ({ data, jobId, sourceType }: { data: unknown[]; jobId?: string; sourceType?: string }) =>
    applicantsApi.bulkCreate(data, jobId, sourceType)
);
export const updateApplicant = createAsyncThunk("applicants/update", ({ id, data }: { id: string; data: unknown }) => applicantsApi.update(id, data));
export const deleteApplicant   = createAsyncThunk("applicants/delete",   (id: string) => applicantsApi.delete(id).then(() => id));
export const restoreApplicant = createAsyncThunk("applicants/restore", (id: string) => applicantsApi.restore(id));

const applicantsSlice = createSlice({
  name: "applicants",
  initialState: {
    list: [],
    selected: null,
    loading: false,
    error: null,
    total: 0,
    page: 1,
    totalPages: 1,
    hasMore: false,
  } as ApplicantsState,
  reducers: {
    clearApplicants: (state) => {
      state.list = [];
      state.total = 0;
      state.page = 1;
      state.totalPages = 1;
      state.hasMore = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApplicants.pending,        (state)         => { state.loading = true; state.error = null; })
      .addCase(fetchApplicants.fulfilled,      (state, action) => {
        state.loading = false;
        const { list, total, page, totalPages, hasMore } = extractList(action.payload);
        // FIX: if loading page > 1 (Load More), append; otherwise replace
        if (page > 1) {
          state.list = [...(state.list as unknown[]), ...list];
        } else {
          state.list = list;
        }
        state.total = total;
        state.page = page;
        state.totalPages = totalPages;
        state.hasMore = hasMore;
      })
      .addCase(fetchApplicants.rejected,       (state, action) => { state.loading = false; state.error = action.error.message ?? null; })

      .addCase(fetchApplicantsByJob.pending,   (state)         => { state.loading = true; state.error = null; })
      .addCase(fetchApplicantsByJob.fulfilled, (state, action) => {
        state.loading = false;
        const { list, total, page, totalPages, hasMore } = extractList(action.payload);
        state.list = list;
        state.total = total;
        state.page = page;
        state.totalPages = totalPages;
        state.hasMore = hasMore;
      })
      .addCase(fetchApplicantsByJob.rejected,  (state, action) => { state.loading = false; state.error = action.error.message ?? null; })

      .addCase(fetchApplicant.fulfilled, (state, action) => { state.selected = action.payload; })

      .addCase(createApplicant.fulfilled, (state, action) => {
        (state.list as unknown[]).unshift(action.payload);
        state.total += 1;
      })

      // FIX: bulkCreate response now has { inserted, duplicateWarnings, crossJobMatches }
      .addCase(bulkCreateApplicants.fulfilled, (state, action) => {
        const payload = action.payload as any;
        const inserted: unknown[] = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload?.inserted) ? payload.inserted : []);
        // FIX: normalize _id → id so frontend ID lookups work on freshly inserted docs
        const normalized = inserted.map((a: any) => ({
          ...a,
          id: a.id || a._id?.toString(),
        }));
        state.list = [...normalized, ...(state.list as unknown[])];
        state.total += normalized.length;
      })

      .addCase(updateApplicant.fulfilled, (state, action) => {
        const payload = action.payload as { id: string };
        const idx = (state.list as { id: string }[]).findIndex(a => a.id === payload.id);
        if (idx !== -1) (state.list as unknown[])[idx] = payload;
        if ((state.selected as { id: string } | null)?.id === payload.id) state.selected = payload;
      })

      .addCase(deleteApplicant.fulfilled, (state, action) => {
        state.list = (state.list as { id: string }[]).filter(a => a.id !== action.payload);
        state.allList = (state.allList as { id: string }[]).filter(a => a.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })

      .addCase(restoreApplicant.fulfilled, (state, action) => {
        const restored = action.payload as any;
        const id = restored.id || restored._id?.toString();
        // Add back to both lists if not already present
        if (!(state.list as { id: string }[]).find(a => a.id === id)) {
          (state.list as unknown[]).unshift({ ...restored, id });
          state.total += 1;
        }
        if (!(state.allList as { id: string }[]).find(a => a.id === id)) {
          (state.allList as unknown[]).unshift({ ...restored, id });
        }
      });
  },
});

export const { clearApplicants } = applicantsSlice.actions;
export default applicantsSlice.reducer;
