import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import projectReducer from './slices/projectSlice';
import uiReducer from './slices/uiSlice';
import promptReducer from './slices/promptSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    project: projectReducer,
    ui: uiReducer,
    prompt: promptReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;