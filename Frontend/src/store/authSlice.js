import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { auth } from "@/api/backend";

export const loginUser = createAsyncThunk("auth/login", async ({ email, password }) => {
  const data = await auth.login(email, password);
  localStorage.setItem("hr_token", data.token);
  return data.user;
});

export const loadCurrentUser = createAsyncThunk("auth/me", async () => {
  return await auth.me();
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    isAuthenticated: false,
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem("hr_token");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending,           (state)          => { state.loading = true; state.error = null; })
      .addCase(loginUser.fulfilled,         (state, action)  => { state.loading = false; state.user = action.payload; state.isAuthenticated = true; })
      .addCase(loginUser.rejected,          (state, action)  => { state.loading = false; state.error = action.error.message; })
      .addCase(loadCurrentUser.fulfilled,   (state, action)  => { state.user = action.payload; state.isAuthenticated = true; })
      .addCase(loadCurrentUser.rejected,    (state)          => { state.isAuthenticated = false; });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;
