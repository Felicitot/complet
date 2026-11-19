import { request } from "./client.js";

export const login = (password) => request("/auth/login", { method: "POST", body: { password } });

export const getSettings = (token) => request("/admin/settings", { token });
export const saveSettings = (token, patch) => request("/admin/settings", { method: "PUT", body: patch, token });
export const testPath = (token, params) => request(`/admin/settings/test?${new URLSearchParams(params)}`, { token });

export const getTasks = (token) => request("/admin/tasks", { token });
export const getScripts = (token) => request("/admin/scripts", { token });
export const createTask = (token, task) => request("/admin/tasks", { method: "POST", body: task, token });
export const updateTask = (token, id, patch) => request(`/admin/tasks/${id}`, { method: "PATCH", body: patch, token });
export const deleteTask = (token, id) => request(`/admin/tasks/${id}`, { method: "DELETE", token });
export const runTaskNow = (token, id) => request(`/admin/tasks/${id}/run`, { method: "POST", token });
export const getTaskRuns = (token, id, limit = 10) => request(`/admin/tasks/${id}/runs?limit=${limit}`, { token });
